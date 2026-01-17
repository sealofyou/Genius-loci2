"""
地灵对话 API 路由
功能：提供流式对话接口
作者：Claude Sonnet 4.5
创建时间：2025-01-17
更新时间：2025-01-17（新增会话结束接口）
"""

import logging
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel, Field
from app.models.schemas import (
    GeniusLociChatRequest,
    GeniusLociChatResponse,
    ApiResponse,
    GetAISummaryRequest,
    AISummaryResponse
)
from app.services.genius_loci_service import (
    genius_loci_chat_stream,
    session_manager,
    archive_conversation
)
from app.core.database import get_ai_summary_by_bubble_id

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/genius-loci", tags=["地灵对话"])


# ========================================
# 流式对话端点
# ========================================

@router.post("/chat", response_model=GeniusLociChatResponse)
async def chat_with_genius_loci(request: GeniusLociChatRequest):
    """
    地灵流式对话接口

    业务逻辑：
    1. **首次对话（冷启动/场景感知）**：
       - 视觉层：解析图片生成场景描述
       - 记忆层：检索1km内的历史记忆
       - 上下文注入：结合场景+记忆生成开场白
       - 创建场景气泡记录（note_type=3）

    2. **多轮对话（标准交互）**：
       - 维护会话窗口记忆
       - 流式响应用户消息

    3. **异步归档**：
       - 对话结束后总结并存储到 genius_loci_record 表
       - 只存储当前用户的对话，不包含检索到的他人记忆

    Args:
        request: 对话请求

    Returns:
        StreamingResponse: SSE 流式响应

    请求示例：
    ```json
    {
        "user_id": 1,
        "message": "你好，今天天气真好！",
        "gps_longitude": 120.15507,
        "gps_latitude": 30.27408,
        "session_id": null,
        "image_url": "https://example.com/image.jpg"
    }
    ```
    """
    try:
        logger.info(
            f"收到地灵对话请求: user_id={request.user_id}, "
            f"message={request.message[:50]}, "
            f"location=({request.gps_longitude}, {request.gps_latitude}), "
            f"session_id={request.session_id}"
        )

        # 生成流式响应
        async def generate():
            """生成 SSE 流式响应"""
            actual_session_id = None
            first_chunk = True

            try:
                # 调用核心服务
                async for chunk in genius_loci_chat_stream(
                    user_id=request.user_id,
                    message=request.message,
                    gps_longitude=request.gps_longitude,
                    gps_latitude=request.gps_latitude,
                    session_id=request.session_id,
                    image_url=request.image_url
                ):
                    # 首次发送时包含 session_id
                    if first_chunk:
                        # 查找当前用户的会话（可能是新创建的）
                        for sid, sess in session_manager.sessions.items():
                            if sess["user_id"] == request.user_id:
                                actual_session_id = sid
                                break

                        if actual_session_id:
                            # 构建包含 session_id 的元数据
                            metadata = {
                                "type": "metadata",
                                "session_id": actual_session_id,
                                "code": 200
                            }
                            # 发送元数据
                            yield f"data: {json.dumps(metadata, ensure_ascii=False)}\n\n"
                            first_chunk = False

                    # 发送文本块
                    data = {
                        "type": "content",
                        "content": chunk
                    }
                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

                # 发送结束标志
                end_data = {
                    "type": "end",
                    "code": 200
                }
                yield f"data: {json.dumps(end_data, ensure_ascii=False)}\n\n"

            except Exception as e:
                logger.error(f"流式生成异常: {e}")
                # 发送错误信息
                error_data = {
                    "type": "error",
                    "code": 500,
                    "message": str(e)
                }
                yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

    except Exception as e:
        logger.error(f"地灵对话接口异常: {e}")
        raise HTTPException(status_code=500, detail=f"对话服务异常: {str(e)}")


# ========================================
# 健康检查端点
# ========================================

@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "code": 200,
        "message": "地灵对话服务运行正常",
        "data": {
            "service": "genius-loci-chat",
            "status": "active"
        }
    }


# ========================================
# 会话结束端点
# ========================================

class EndSessionRequest(BaseModel):
    """结束会话请求模型"""
    session_id: str = Field(..., description="会话 ID")
    user_id: int = Field(..., description="用户 ID")

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "uuid-string",
                "user_id": 1
            }
        }


@router.post("/end-session")
async def end_session(request: EndSessionRequest):
    """
    结束会话接口（用户主动触发）

    使用场景：
    - 用户关闭对话页面
    - 用户点击"结束对话"按钮
    - 页面卸载前调用（beforeunload/unload 事件）

    执行逻辑：
    1. 获取会话信息
    2. 总结对话内容
    3. 归档到数据库
    4. 清除内存会话

    请求示例：
    ```json
    {
        "session_id": "uuid-string",
        "user_id": 1
    }
    ```

    前端调用示例：
    ```javascript
    // 页面卸载时自动结束会话
    window.addEventListener('beforeunload', () => {
        navigator.sendBeacon('/api/v1/genius-loci/end-session', JSON.stringify({
            session_id: currentSessionId,
            user_id: currentUserId
        }));
    });

    // 或用户主动点击结束按钮
    async function endChat() {
        await fetch('/api/v1/genius-loci/end-session', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: currentSessionId,
                user_id: currentUserId
            })
        });
    }
    ```
    """
    try:
        session_id = request.session_id
        user_id = request.user_id

        logger.info(f"收到结束会话请求: session_id={session_id}, user_id={user_id}")

        # 获取会话信息
        session = session_manager.get_session(session_id)
        if not session:
            logger.warning(f"会话不存在或已结束: session_id={session_id}")
            return {
                "code": 404,
                "message": "会话不存在或已结束",
                "data": None
            }

        # 验证用户 ID
        if session["user_id"] != user_id:
            logger.warning(f"用户ID不匹配: session_id={session_id}")
            return {
                "code": 403,
                "message": "无权结束该会话",
                "data": None
            }

        # 获取归档所需数据
        bubble_id = session.get("bubble_id")
        conversation = session.get("history", [])
        gps_longitude = session["location"]["longitude"]
        gps_latitude = session["location"]["latitude"]

        # 异步归档对话
        if conversation and bubble_id:
            logger.info(f"开始归档会话: session_id={session_id}, bubble_id={bubble_id}, 对话轮数={len(conversation)//2}")
            await archive_conversation(
                bubble_id=bubble_id,
                user_id=user_id,
                session_id=session_id,
                conversation=conversation,
                gps_longitude=gps_longitude,
                gps_latitude=gps_latitude
            )
        else:
            if not conversation:
                logger.info(f"会话无对话记录，跳过归档: session_id={session_id}")
            if not bubble_id:
                logger.warning(f"会话无关联气泡，无法归档: session_id={session_id}")

        # 清除会话
        session_manager.clear_session(session_id)

        logger.info(f"✓ 会话已结束: session_id={session_id}")

        return {
            "code": 200,
            "message": "会话已成功结束",
            "data": {
                "session_id": session_id,
                "conversation_turns": len(conversation) // 2 if conversation else 0,
                "archived": bool(conversation and bubble_id)
            }
        }

    except Exception as e:
        logger.error(f"结束会话异常: {e}")
        raise HTTPException(status_code=500, detail=f"结束会话失败: {str(e)}")


# ========================================
# 会话状态查询端点
# ========================================

@router.get("/session/{session_id}")
async def get_session_status(session_id: str):
    """
    查询会话状态

    Args:
        session_id: 会话 ID

    Returns:
        会话状态信息
    """
    try:
        session = session_manager.get_session(session_id)

        if not session:
            return {
                "code": 404,
                "message": "会话不存在",
                "data": None
            }

        return {
            "code": 200,
            "message": "会话存在",
            "data": {
                "session_id": session_id,
                "user_id": session.get("user_id"),
                "bubble_id": session.get("bubble_id"),
                "conversation_turns": session.get("conversation_turns", 0),
                "is_first": session.get("is_first", False),
                "location": session.get("location"),
                "auto_archive_threshold": 100  # 提示前端自动归档阈值
            }
        }

    except Exception as e:
        logger.error(f"查询会话状态异常: {e}")
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


# ========================================
# AI 总结查询端点
# ========================================

@router.post("/ai-summary", response_model=AISummaryResponse)
async def get_ai_summary(request: GetAISummaryRequest):
    """
    获取笔记的 AI 总结

    功能：根据 note_id（bubble_id）查询对应的 AI 总结结果

    业务逻辑：
    1. 在 genius_loci_record 表中查找 bubble_id = note_id 的记录
    2. 筛选 ai_process_type = 5（对话总结）的记录
    3. 提取 ai_result 字段（JSON 格式，包含 summary, turns, session_id）

    异常处理：
    - 200: 成功返回 AI 总结
    - 202: AI 总结正在生成中（ai_result 为空）
    - 404: 未找到对应记录

    请求示例：
    ```json
    {
        "note_id": 123,
        "user_id": 1
    }
    ```

    响应示例（成功）：
    ```json
    {
        "code": 200,
        "message": "success",
        "data": {
            "note_id": 123,
            "ai_result": {
                "summary": "用户表达了对天气的喜悦...",
                "turns": 5,
                "session_id": "uuid-string"
            },
            "process_time": "2025-01-17T12:00:00",
            "model_version": "gpt-4"
        }
    }
    ```

    响应示例（处理中）：
    ```json
    {
        "code": 202,
        "message": "AI 总结正在生成中，请稍后查询",
        "data": {
            "note_id": 123,
            "status": "processing"
        }
    }
    ```
    """
    try:
        logger.info(f"查询 AI 总结: note_id={request.note_id}, user_id={request.user_id}")

        # 查询 AI 总结记录
        record = await get_ai_summary_by_bubble_id(
            bubble_id=request.note_id,
            user_id=request.user_id  # 进行权限验证
        )

        if not record:
            # 未找到记录
            return AISummaryResponse(
                code=404,
                message="未找到 AI 总结记录，该笔记可能尚未归档",
                data={
                    "note_id": request.note_id,
                    "hint": "请先结束会话以触发 AI 总结"
                }
            )

        # 检查 ai_result 是否为空
        ai_result = record.get("ai_result")

        if not ai_result or not ai_result.strip():
            # AI 总结正在生成中
            return AISummaryResponse(
                code=202,
                message="AI 总结正在生成中，请稍后查询",
                data={
                    "note_id": request.note_id,
                    "status": "processing",
                    "record_id": record.get("id")
                }
            )

        # 解析 ai_result（应该是 JSON 格式）
        try:
            import json
            ai_result_json = json.loads(ai_result)
        except:
            # 如果不是 JSON 格式，直接返回字符串
            ai_result_json = {"raw": ai_result}

        # 成功返回
        return AISummaryResponse(
            code=200,
            message="success",
            data={
                "note_id": request.note_id,
                "ai_result": ai_result_json,
                "process_time": record.get("process_time"),
                "model_version": record.get("model_version"),
                "record_id": record.get("id")
            }
        )

    except Exception as e:
        logger.error(f"查询 AI 总结异常: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"查询失败: {str(e)}"
        )
