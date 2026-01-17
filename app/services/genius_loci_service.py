"""
地灵对话核心服务（V2）
功能：整合视觉感知、记忆检索、流式对话，实现完整的对话逻辑
更新时间：2025-01-17
更新内容：
1. 实现会话超时机制（30分钟无操作自动归档）
2. 关联 bubble_id 到 genius_loci_record 表
3. 适配实际表结构（bubble_id, ai_process_type等字段）
"""

import logging
import uuid
import asyncio
import time
import json
from typing import AsyncGenerator, Optional, List, Dict, Any
from app.services.vision_service import vision_service
from app.services.chat_service import chat_service
from app.core.database import (
    create_genius_loci_record,
    get_nearby_genius_loci_memory,
    create_bubble_note
)
from app.core.config import settings
from app.core.database import db

logger = logging.getLogger(__name__)


# ========================================
# 配置常量
# ========================================

SESSION_TIMEOUT = 30 * 60  # 会话超时时间（秒），默认30分钟
AUTO_ARCHIVE_TURNS = 100  # 每100轮对话后自动归档并开启新会话
AI_PROCESS_TYPE_CHAT_SUMMARY = 5  # AI处理类型：5-对话总结


# ========================================
# 会话状态管理（内存存储 + 超时机制）
# ========================================

class SessionManager:
    """会话状态管理器（单例模式 + 超时机制）"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化会话管理器"""
        if SessionManager._initialized:
            return

        # 会话存储：{session_id: {...}}
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.last_activity: Dict[str, float] = {}  # 最后活跃时间

        SessionManager._initialized = True
        logger.info("会话管理器初始化成功（含超时机制）")

        # 启动超时检查任务
        asyncio.create_task(self._check_expired_sessions())

    def create_session(
        self,
        user_id: int,
        gps_longitude: float,
        gps_latitude: float,
        image_url: Optional[str] = None
    ) -> str:
        """
        创建新会话

        Args:
            user_id: 用户 ID
            gps_longitude: 经度
            gps_latitude: 纬度
            image_url: 图片 URL（可选）

        Returns:
            会话 ID
        """
        session_id = str(uuid.uuid4())

        self.sessions[session_id] = {
            "user_id": user_id,
            "location": {
                "longitude": gps_longitude,
                "latitude": gps_latitude
            },
            "image_url": image_url,
            "history": [],  # 对话历史
            "bubble_id": None,  # 关联的气泡 ID（首次对话时创建）
            "is_first": True,  # 是否为首次对话
            "vision_analyzed": False,  # 是否已进行视觉分析
            "context_initialized": False,  # 是否已初始化上下文
            "conversation_turns": 0  # 对话轮数计数器
        }

        self.last_activity[session_id] = time.time()

        logger.info(f"创建新会话: session_id={session_id}, user_id={user_id}")
        return session_id

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话信息"""
        return self.sessions.get(session_id)

    def update_activity(self, session_id: str):
        """更新会话活跃时间"""
        if session_id in self.sessions:
            self.last_activity[session_id] = time.time()
            logger.debug(f"更新会话活跃时间: session_id={session_id}")

    def add_to_history(self, session_id: str, role: str, content: str):
        """添加对话记录到历史"""
        if session_id in self.sessions:
            self.sessions[session_id]["history"].append({
                "role": role,
                "content": content
            })
            logger.debug(f"添加到会话历史: session_id={session_id}, role={role}")

    def increment_turns(self, session_id: str):
        """增加对话轮数"""
        if session_id in self.sessions:
            self.sessions[session_id]["conversation_turns"] += 1
            turns = self.sessions[session_id]["conversation_turns"]
            logger.debug(f"对话轮数: session_id={session_id}, turns={turns}")
            return turns
        return 0

    def get_turns(self, session_id: str) -> int:
        """获取当前对话轮数"""
        if session_id in self.sessions:
            return self.sessions[session_id].get("conversation_turns", 0)
        return 0

    def set_bubble_id(self, session_id: str, bubble_id: int):
        """设置关联的气泡 ID"""
        if session_id in self.sessions:
            self.sessions[session_id]["bubble_id"] = bubble_id
            logger.info(f"关联气泡ID: session_id={session_id}, bubble_id={bubble_id}")

    async def _check_expired_sessions(self):
        """定期检查并清理超时会话（后台任务）"""
        while True:
            try:
                await asyncio.sleep(60)  # 每分钟检查一次

                current_time = time.time()
                expired_sessions = []

                for session_id, last_time in self.last_activity.items():
                    if current_time - last_time > SESSION_TIMEOUT:
                        expired_sessions.append(session_id)

                # 归档超时会话
                for session_id in expired_sessions:
                    logger.info(f"会话超时，准备归档: session_id={session_id}")
                    await self._archive_session_sync(session_id)

            except Exception as e:
                logger.error(f"检查超时会话异常: {e}")

    async def _archive_session_sync(self, session_id: str):
        """同步归档会话（超时触发）"""
        try:
            session = self.sessions.get(session_id)
            if not session:
                return

            # 调用异步归档
            await archive_conversation(
                bubble_id=session.get("bubble_id"),
                user_id=session["user_id"],
                session_id=session_id,
                conversation=session["history"],
                gps_longitude=session["location"]["longitude"],
                gps_latitude=session["location"]["latitude"]
            )

            # 清除会话
            self.clear_session(session_id)

        except Exception as e:
            logger.error(f"归档超时会话失败: {e}")

    def clear_session(self, session_id: str):
        """清除会话"""
        if session_id in self.sessions:
            del self.sessions[session_id]
        if session_id in self.last_activity:
            del self.last_activity[session_id]
        logger.info(f"清除会话: session_id={session_id}")


# 全局会话管理器实例
session_manager = SessionManager()


# ========================================
# 地灵对话核心逻辑
# ========================================

async def genius_loci_chat_stream(
    user_id: int,
    message: str,
    gps_longitude: float,
    gps_latitude: float,
    session_id: Optional[str] = None,
    image_url: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    地灵对话流式响应（核心业务逻辑 V2）

    业务逻辑：
    1. **首次对话（冷启动/场景感知）**：
       - 视觉层：解析图片生成场景描述
       - 记忆层：检索1km内的历史记忆
       - 上下文注入：结合场景+记忆生成开场白
       - 创建场景气泡记录（note_type=3）

    2. **多轮对话（标准交互）**：
       - 维护会话窗口记忆
       - 流式响应用户消息
       - 更新会话活跃时间

    3. **会话超时自动归档**：
       - 30分钟无操作自动归档
       - 归档到 genius_loci_record 表
       - 关联 bubble_id

    Args:
        user_id: 用户 ID
        message: 用户消息
        gps_longitude: 经度
        gps_latitude: 纬度
        session_id: 会话 ID（如果为 None 则创建新会话）
        image_url: 图片 URL（首次对话时传入）

    Yields:
        流式文本片段
    """
    try:
        # ========================================
        # 1. 会话管理
        # ========================================

        is_new_session = False
        if not session_id:
            # 创建新会话
            session_id = session_manager.create_session(
                user_id=user_id,
                gps_longitude=gps_longitude,
                gps_latitude=gps_latitude,
                image_url=image_url
            )
            is_new_session = True
            logger.info(f"新会话创建: session_id={session_id}")
        else:
            # 获取现有会话
            session = session_manager.get_session(session_id)
            if not session:
                logger.warning(f"会话不存在，创建新会话: session_id={session_id}")
                session_id = session_manager.create_session(
                    user_id=user_id,
                    gps_longitude=gps_longitude,
                    gps_latitude=gps_latitude,
                    image_url=image_url
                )
                is_new_session = True

        # 更新会话活跃时间
        session_manager.update_activity(session_id)
        session = session_manager.get_session(session_id)

        # ========================================
        # 渐进式归档检查（每N轮对话自动归档）
        # ========================================

        current_turns = session_manager.get_turns(session_id)
        should_archive = (current_turns > 0 and current_turns % AUTO_ARCHIVE_TURNS == 0)

        if should_archive:
            logger.info(f"🔄 触发渐进式归档: session_id={session_id}, turns={current_turns}")

            # 归档当前会话
            await archive_conversation(
                bubble_id=session.get("bubble_id"),
                user_id=user_id,
                session_id=session_id,
                conversation=session["history"],
                gps_longitude=session["location"]["longitude"],
                gps_latitude=session["location"]["latitude"]
            )

            # 创建新会话（继承上下文）
            old_bubble_id = session.get("bubble_id")
            old_session_id = session_id

            # 注意：新会话不再需要图片，因为已经分析过了
            # 同时保留历史记录的前几轮作为上下文
            history_context = session["history"][-10:] if len(session["history"]) > 10 else session["history"]

            new_session_id = session_manager.create_session(
                user_id=user_id,
                gps_longitude=gps_longitude,
                gps_latitude=gps_latitude,
                image_url=None
            )

            # 继承上下文到新会话
            session_manager.sessions[new_session_id]["history"] = history_context
            session_manager.sessions[new_session_id]["bubble_id"] = old_bubble_id
            session_manager.sessions[new_session_id]["is_first"] = False
            session_manager.sessions[new_session_id]["context_initialized"] = True

            # 切换到新会话
            session_id = new_session_id
            session = session_manager.get_session(session_id)

            # 清除旧会话
            session_manager.clear_session(old_session_id)

            logger.info(f"✓ 渐进式归档完成，已切换到新会话: old={old_session_id[:8]}..., new={new_session_id[:8]}...")

        # ========================================
        # 2. 首次对话逻辑：创建场景气泡 + 构建上下文
        # ========================================

        system_context = None  # 初始化上下文变量（用于对话）

        if session["is_first"]:
            logger.info("触发首次对话逻辑：创建场景气泡")

            # 2.0 使用 BubbleNoteService 创建气泡记录（包含情感识别）
            try:
                from app.services.bubble_service import BubbleNoteService
                from app.models.schemas import BubbleNoteCreate

                bubble_service = BubbleNoteService()

                print("user_id", user_id)
                # 构建 BubbleNoteCreate 对象
                note_data = BubbleNoteCreate(
                    user_id=user_id,
                    content=message,  # 用户消息作为内容
                    gps_longitude=gps_longitude,
                    gps_latitude=gps_latitude,
                    note_type=3,  # 对话
                    status=1
                )

                # 调用服务层处理（会自动进行情感识别）
                result = await bubble_service.create_or_update_note(note_data)

                if result and result.get("note_id"):
                    bubble_id = result.get("note_id")
                    session_manager.set_bubble_id(session_id, bubble_id)
                    emotion = result.get("emotion", "平静")
                    logger.info(f"✓ 场景气泡记录创建成功: bubble_id={bubble_id}, emotion={emotion}")
                else:
                    logger.warning("⚠ 气泡创建返回异常结果")

            except Exception as e:
                logger.error(f"✗ 场景气泡记录创建失败: {e}")

            # 2.1 视觉层：图片解析（如果有图片）
            vision_description = None
            if image_url:
                if not session["vision_analyzed"]:
                    try:
                        logger.info(f"开始视觉分析，图片URL: {image_url}")
                        vision_description = await vision_service.analyze_image(image_url)
                        session["vision_analyzed"] = True

                        if vision_description:
                            logger.info(f"✓ 视觉分析完成: {vision_description}")
                        else:
                            logger.warning("✗ 视觉分析失败，跳过视觉信息")
                    except Exception as e:
                        logger.error(f"✗ 视觉分析异常: {e}")

            # 2.2 记忆层：检索历史记忆
            memory_result = None
            try:
                logger.info(f"检索附近记忆，位置: ({gps_longitude}, {gps_latitude})")
                memory_result = await get_nearby_genius_loci_memory(
                    gps_longitude=gps_longitude,
                    gps_latitude=gps_latitude,
                    radius_km=1.0,
                    exclude_user_id=user_id,  # 排除当前用户
                    ai_process_type=AI_PROCESS_TYPE_CHAT_SUMMARY
                )

                if memory_result:
                    # 解析 JSON 格式的 ai_result
                    try:
                        ai_result_json = json.loads(memory_result.get("ai_result", "{}"))
                        memory_summary = ai_result_json.get("summary", memory_result.get("ai_result", ""))
                        logger.info(f"✓ 检索到历史记忆: {memory_summary[:50]}...")
                    except:
                        logger.info(f"✓ 检索到历史记忆: {memory_result.get('ai_result', '')[:50]}...")
                else:
                    logger.info("✓ 附近无历史记忆，跳过记忆检索")

            except Exception as e:
                logger.error(f"✗ 记忆检索异常: {e}")

            # 2.3 构建场景内容（视觉+记忆+用户输入）
            content_parts = []
            if message:
                content_parts.append(f"用户输入: {message}")
            if vision_description:
                content_parts.append(f"\n【场景描述】{vision_description}")
            if memory_result:
                try:
                    ai_result_json = json.loads(memory_result.get("ai_result", "{}"))
                    memory_summary = ai_result_json.get("summary", "")
                    content_parts.append(f"\n【此地记忆】{memory_summary}")
                except:
                    content_parts.append(f"\n【此地记忆】{memory_result.get('ai_result', '')}")

            # # 即使没有任何额外信息，也要创建气泡（用户至少输入了消息）
            # if not content_parts:
            #     content_parts.append("用户发起了对话")

            # final_content = "\n".join(content_parts)

            # # 2.4 创建场景气泡记录（note_type=3）⭐ 必须创建
            # # 参考 create_or_update_note 方法的最佳实践
            # try:
            #     # 内容完整性校验
            #     has_content = final_content is not None and len(final_content.strip()) > 0
            #     has_images = image_url is not None and len(image_url.strip()) > 0

            #     if not has_content and not has_images:
            #         logger.warning("内容与图片均为空，跳过创建气泡")
            #         session["is_first"] = False
            #         session["context_initialized"] = True
            #         return  # 跳过后续逻辑

            #     # 情感识别（如果有文本内容）
            #     emotion = "平静"  # 默认情感
            #     if has_content:
            #         try:
            #             from app.services.emotion_service import analyze_emotion
            #             emotion = analyze_emotion(final_content)
            #             logger.info(f"情感识别结果: {emotion}")
            #         except ImportError:
            #             logger.warning("情感分析模块未导入，使用默认情感值")
            #         except Exception as e:
            #             logger.error(f"情感识别失败，使用默认值: {e}")

                # # 确定 note_type
                # note_type = 1 if has_images else 3  # 有图片为1(图文)，无图片为3(场景气泡)

                # # 构建数据库记录
                # note_data = {
                #     "user_id": user_id,
                #     "note_type": note_type,
                #     "content": final_content if has_content else "",
                #     "image_urls": image_url if has_images else None,
                #     "gps_longitude": gps_longitude,
                #     "gps_latitude": gps_latitude,
                #     "status": 3,  # 私有
                #     "emotion": emotion
                # }

                # # 创建气泡记录
                # bubble = await create_bubble_note(note_data)

                # if bubble:
                #     bubble_id = bubble.get("id")
                #     session_manager.set_bubble_id(session_id, bubble_id)
                #     logger.info(f"✓ 场景气泡记录创建成功: bubble_id={bubble_id}, note_type={note_type}, emotion={emotion}")
                # else:
                #     logger.error("✗ 场景气泡记录创建失败")

            # except ValueError as e:
            #     # 业务逻辑校验失败
            #     logger.error(f"业务校验失败: {e}")
            # except Exception as e:
            #     logger.error(f"✗ 场景气泡记录创建失败: {e}")

            # 标记首次对话完成
            session["is_first"] = False
            session["context_initialized"] = True

            # 2.5 构建系统上下文（用于首次对话的流式响应）
            context_parts = []
            if vision_description:
                context_parts.append(f"【当前场景】{vision_description}")
            if memory_result:
                try:
                    ai_result_json = json.loads(memory_result.get("ai_result", "{}"))
                    memory_summary = ai_result_json.get("summary", memory_result.get("ai_result", ""))
                    context_parts.append(f"【此地记忆】{memory_summary}")
                except:
                    context_parts.append(f"【此地记忆】{memory_result.get('ai_result', '')}")

            if context_parts:
                system_context = "\n".join(context_parts)
                logger.info(f"✓ 首次对话上下文构建完成:\n{system_context}")

        # ========================================
        # 3. 多轮对话：流式响应
        # ========================================

        logger.info(f"开始流式对话，session_id={session_id}")

        # 获取会话历史
        session_history = session["history"]

        # 调用对话服务
        full_response = ""
        async for chunk in chat_service.chat_stream(
            user_message=message,
            session_history=session_history,
            system_context=system_context
        ):
            full_response += chunk
            yield chunk

        # ========================================
        # 4. 记录对话历史并更新轮数
        # ========================================

        session_manager.add_to_history(session_id, "user", message)
        session_manager.add_to_history(session_id, "assistant", full_response)

        # 增加对话轮数
        turns = session_manager.increment_turns(session_id)

        logger.info(f"对话完成: session_id={session_id}, turns={turns}/{AUTO_ARCHIVE_TURNS}, response_length={len(full_response)}")

    except Exception as e:
        logger.error(f"地灵对话异常: {e}")
        yield f"\n\n[系统错误: {str(e)}]"


# ========================================
# 对话归档逻辑（手动触发）
# ========================================

async def archive_conversation(
    bubble_id: Optional[int],
    user_id: int,
    session_id: str,
    conversation: List[Dict[str, str]],
    gps_longitude: float,
    gps_latitude: float
):
    """
    归档对话总结（手动或超时触发）

    Args:
        bubble_id: 关联的气泡 ID
        user_id: 用户 ID
        session_id: 会话 ID
        conversation: 对话记录列表
        gps_longitude: 经度
        gps_latitude: 纬度
    """
    try:
        if not conversation:
            logger.info(f"对话历史为空，跳过归档: session_id={session_id}")
            return

        if not bubble_id:
            logger.warning(f"bubble_id 为空，无法归档: session_id={session_id}")
            return

        logger.info(f"开始归档对话，session_id={session_id}, bubble_id={bubble_id}, 对话轮数: {len(conversation) // 2}")

        # 调用对话服务进行总结
        summary_text = await chat_service.summarize_conversation(conversation)

        if not summary_text:
            logger.warning("对话总结失败，使用原始对话")
            summary_text = _build_simple_summary(conversation)

        # 构建 JSON 格式的 ai_result
        ai_result_json = {
            "summary": summary_text,
            "turns": len(conversation) // 2,
            "session_id": session_id
        }

        # 保存到数据库（使用实际的表结构）
        record = await create_genius_loci_record(
            bubble_id=bubble_id,
            user_id=user_id,
            ai_process_type=AI_PROCESS_TYPE_CHAT_SUMMARY,  # 5-对话总结
            ai_result=json.dumps(ai_result_json, ensure_ascii=False),
            model_version=settings.MODEL_NAME,
            gps_longitude=gps_longitude,
            gps_latitude=gps_latitude
        )

        if record:
            logger.info(f"✓ 对话归档成功: record_id={record['id']}, bubble_id={bubble_id}")
        else:
            logger.error("✗ 对话归档失败")

    except Exception as e:
        logger.error(f"归档对话异常: {e}")


def _build_simple_summary(conversation: List[Dict[str, str]]) -> str:
    """
    构建简单的对话摘要（当 AI 总结失败时的备用方案）

    Args:
        conversation: 对话记录

    Returns:
        简单摘要
    """
    # 只保留最近3轮对话
    recent_conversation = conversation[-6:] if len(conversation) > 6 else conversation

    summary_parts = []
    for msg in recent_conversation:
        role = "用户" if msg["role"] == "user" else "地灵"
        summary_parts.append(f"{role}说：{msg['content']}")

    return " | ".join(summary_parts)
