"""
气泡笔记业务服务
"""

import logging
from typing import Optional, List, Dict, Any

from app.utils.emotion_analyzer import analyze_emotion
from app.core.database import create_bubble_note, update_bubble_note, get_bubble_note_by_id
from app.core.oss_storage import oss_storage
from app.models.schemas import BubbleNoteCreate

logger = logging.getLogger(__name__)


class BubbleNoteService:
    """气泡笔记服务类"""

    def __init__(self):
        """初始化服务"""
        pass

    async def create_or_update_note(
        self,
        data: BubbleNoteCreate,
        images_data: Optional[List[bytes]] = None
    ) -> Dict[str, Any]:
        """
        创建或更新气泡笔记 (核心业务流程)

        业务流程:
        1. 前置校验 (内容完整性、坐标范围、操作幂等性)
        2. 多媒体处理 (并发上传图片到 OSS)
        3. 情感识别 (调用 AI 模型分析情感)
        4. 数据库持久化 (原子性 Upsert)

        Args:
            data: 笔记请求数据
            images_data: 图片二进制数据列表 (可选)

        Returns:
            操作结果 (包含 note_id 和 emotion)
        """
        try:
            # ========================================
            # 第一阶段: 入参前置校验
            # ========================================

            # 1.1 内容完整性校验
            has_content = data.content is not None and len(data.content.strip()) > 0
            has_images = images_data is not None and len(images_data) > 0

            if not has_content and not has_images:
                raise ValueError("content (文本) 与 images (图片) 不可同时为空")

            # 1.2 操作模式判别
            is_update = data.note_id is not None

            if is_update:
                # 更新模式: 校验 note_id 是否存在
                existing_note = await get_bubble_note_by_id(data.note_id)
                if not existing_note:
                    raise ValueError(f"笔记不存在, note_id={data.note_id}")

                # 校验所属权
                if existing_note["user_id"] != data.user_id:
                    raise ValueError("无权限修改该笔记")

                logger.info(f"进入更新模式: note_id={data.note_id}")
            else:
                logger.info("进入创建模式")

            # ========================================
            # 第二阶段: 多媒体与智能异步处理
            # ========================================

            # 2.1 图片上传 (如果有)
            image_urls_str = None
            note_type = data.note_type  # 默认为纯文本
            print("go_note_type", note_type)

            if note_type:
                if has_images:
                    try:
                        # 并发上传所有图片到 OSS
                        uploaded_urls = await oss_storage.upload_images_batch(
                            images_data,
                            data.user_id
                        )
                        note_type = 2
                        # 将 URL 列表转换为逗号分隔的字符串
                        image_urls_str = ",".join(uploaded_urls)

                        logger.info(f"图片上传成功: {len(uploaded_urls)} 张")

                    except Exception as e:
                        # 图片上传失败,触发异常熔断
                        logger.error(f"图片上传失败,终止流程: {e}")
                        raise Exception(f"图片上传失败: {e}")
                else:
                    # 纯文本笔记,保留原有的 image_urls (如果是更新模式)
                    if is_update and existing_note.get("image_urls"):
                        note_type = 1
                        image_urls_str = existing_note["image_urls"]
                        note_type = existing_note["note_type"]

            # 2.2 情感识别 (如果有文本)
            emotion = "未知"  # 默认情感

            if has_content:
                try:
                    # 调用情感分析模型
                    emotion = analyze_emotion(data.content)
                    logger.info(f"情感识别结果: {emotion}")
                except Exception as e:
                    logger.error(f"情感识别失败,使用默认值: {e}")
                    emotion = "未知"
            else:
                # 仅有图片无文本,默认为"平静"或"未知"
                emotion = "平静"

            # ========================================
            # 第三阶段: 数据库持久化
            # ========================================

            # 构建数据库记录
            note_data = {
                "user_id": data.user_id,
                "note_type": note_type,
                "content": data.content if has_content else "",
                "image_urls": image_urls_str,
                "gps_longitude": data.gps_longitude,
                "gps_latitude": data.gps_latitude,
                "status": data.status,
                "emotion": emotion,
            }

            if is_update:
                # 更新模式: 保持 create_time 不变,更新其他字段
                result = await update_bubble_note(data.note_id, data.user_id, note_data)
                if not result:
                    raise Exception("更新笔记失败")
                note_id = data.note_id
            else:
                # 创建模式: 插入新记录
                result = await create_bubble_note(note_data)
                note_id = result["id"]

            logger.info(f"笔记{'更新' if is_update else '创建'}成功: note_id={note_id}, emotion={emotion}")

            return {
                "note_id": note_id,
                "emotion": emotion,
                "note_type": note_type,
                "is_update": is_update
            }

        except ValueError as e:
            # 业务逻辑错误 (校验失败)
            logger.error(f"业务校验失败: {e}")
            raise
        except Exception as e:
            # 系统错误
            logger.error(f"服务处理失败: {e}")
            raise

    async def delete_note(self, note_id: int, user_id: int) -> bool:
        """
        删除气泡笔记 (软删除)

        Args:
            note_id: 笔记 ID
            user_id: 用户 ID

        Returns:
            是否删除成功
        """
        from database import delete_bubble_note

        try:
            success = await delete_bubble_note(note_id, user_id)
            if success:
                logger.info(f"笔记删除成功: note_id={note_id}")
            else:
                logger.warning(f"笔记删除失败: note_id={note_id}")
            return success
        except Exception as e:
            logger.error(f"删除笔记失败: {e}")
            raise


# 全局服务实例
bubble_service = BubbleNoteService()


# ========================================
# 辅助函数
# ========================================

def validate_coordinates(longitude: float, latitude: float) -> bool:
    """
    校验地理坐标合法性

    Args:
        longitude: 经度
        latitude: 纬度

    Returns:
        是否合法
    """
    return -180 <= longitude <= 180 and -90 <= latitude <= 90


def determine_note_type(has_content: bool, has_images: bool) -> int:
    """
    确定笔记类型

    Args:
        has_content: 是否有文本内容
        has_images: 是否有图片

    Returns:
        笔记类型 (1-图文/2-纯文)
    """
    if has_images:
        return 1  # 图文
    elif has_content:
        return 2  # 纯文
    else:
        return 2  # 默认纯文 (但这种情况应该在校验阶段被拦截)


# ========================================
# 测试代码
# ========================================

if __name__ == "__main__":
    import asyncio

    async def test_service():
        """测试服务"""
        print("测试气泡笔记服务...")

        # 创建测试数据 (注意: BubbleNoteCreate 不再包含 images 字段)
        test_data = BubbleNoteCreate(
            user_id=1,
            content="今天真的很开心!",
            gps_longitude=120.15507,
            gps_latitude=30.27408,
            status=1
        )

        try:
            result = await bubble_service.create_or_update_note(test_data)
            print(f"创建成功: {result}")
        except Exception as e:
            print(f"创建失败: {e}")

    # 运行测试
    asyncio.run(test_service())
