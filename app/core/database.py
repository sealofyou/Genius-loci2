"""
Supabase 数据库连接
"""

from typing import Optional, List, Dict, Any
from supabase import create_client, Client
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class Database:
    """数据库连接类 (单例模式)"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化 Supabase 客户端"""
        if Database._initialized:
            return

        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL 和 SUPABASE_KEY 必须在 .env 文件中配置")

        # 创建 Supabase 客户端 (使用匿名 key)
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )

        # 创建管理员客户端 (使用 service_role key, 绕过 RLS)
        self.admin_client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY if settings.SUPABASE_SERVICE_ROLE_KEY else settings.SUPABASE_KEY
        )

        Database._initialized = True
        logger.info("Supabase 客户端初始化成功")

    def get_client(self, use_admin: bool = False) -> Client:
        """
        获取 Supabase 客户端

        Args:
            use_admin: 是否使用管理员客户端 (绕过 RLS)

        Returns:
            Supabase 客户端实例
        """
        return self.admin_client if use_admin else self.client


# 全局数据库实例
db = Database()


# ========================================
# 数据库操作函数
# ========================================

async def create_bubble_note(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    创建新的气泡笔记

    Args:
        data: 笔记数据字典

    Returns:
        插入后的笔记数据 (包含生成的 id)
    """
    try:
        client = db.get_client(use_admin=True)

        # 插入数据
        response = client.table("bubble_note").insert({
            "user_id": data["user_id"],
            "note_type": data["note_type"],
            "content": data["content"],
            "image_urls": data.get("image_urls"),
            "gps_longitude": data["gps_longitude"],
            "gps_latitude": data["gps_latitude"],
            "status": data.get("status", 1),
            "emotion": data.get("emotion", "未知"),
        }).execute()

        if response.data:
            logger.info(f"成功创建气泡笔记, id={response.data[0]['id']}")
            return response.data[0]
        else:
            raise Exception("创建笔记失败: 无返回数据")

    except Exception as e:
        logger.error(f"创建气泡笔记失败: {e}")
        raise


async def update_bubble_note(note_id: int, user_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    更新气泡笔记

    Args:
        note_id: 笔记 ID
        user_id: 用户 ID (用于权限验证)
        data: 更新数据字典

    Returns:
        更新后的笔记数据, 如果不存在或无权限则返回 None
    """
    try:
        client = db.get_client(use_admin=True)

        # 先检查笔记是否存在且属于该用户
        check_response = client.table("bubble_note").select("*").eq("id", note_id).execute()

        if not check_response.data:
            logger.warning(f"笔记不存在, id={note_id}")
            return None

        existing_note = check_response.data[0]
        if existing_note["user_id"] != user_id:
            logger.warning(f"用户无权限修改该笔记, user_id={user_id}, note_id={note_id}")
            return None

        # 构建更新数据 (只更新允许修改的字段)
        update_data = {}
        if "note_type" in data:
            update_data["note_type"] = data["note_type"]
        if "content" in data:
            update_data["content"] = data["content"]
        if "image_urls" in data:
            update_data["image_urls"] = data["image_urls"]
        if "gps_longitude" in data:
            update_data["gps_longitude"] = data["gps_longitude"]
        if "gps_latitude" in data:
            update_data["gps_latitude"] = data["gps_latitude"]
        if "status" in data:
            update_data["status"] = data["status"]
        if "emotion" in data:
            update_data["emotion"] = data["emotion"]

        # 执行更新
        response = client.table("bubble_note").update(update_data).eq("id", note_id).execute()

        if response.data:
            logger.info(f"成功更新气泡笔记, id={note_id}")
            return response.data[0]
        else:
            return None

    except Exception as e:
        logger.error(f"更新气泡笔记失败: {e}")
        raise


async def get_bubble_note_by_id(note_id: int) -> Optional[Dict[str, Any]]:
    """
    根据 ID 获取气泡笔记

    Args:
        note_id: 笔记 ID

    Returns:
        笔记数据, 如果不存在则返回 None
    """
    try:
        client = db.get_client()
        response = client.table("bubble_note").select("*").eq("id", note_id).execute()

        if response.data:
            return response.data[0]
        return None

    except Exception as e:
        logger.error(f"获取气泡笔记失败: {e}")
        raise


async def get_nearby_bubbles(
    longitude: float,
    latitude: float,
    radius_km: float = 1.0,
    limit: int = 20,
    status: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    获取附近的气泡笔记 (使用 PostGIS 地理查询)

    Args:
        longitude: 经度
        latitude: 纬度
        radius_km: 半径 (公里)
        limit: 返回数量限制
        status: 状态筛选 (1-公开/2-私有), None 表示全部

    Returns:
        附近的笔记列表
    """
    try:
        client = db.get_client()

        # 使用 PostGIS 的 ST_DWithin 函数查询附近的点
        # 注意: Supabase RPC 需要在数据库中预先定义函数
        # 这里使用原生 SQL 查询
        query = f"""
        SELECT *,
               ST_Distance(
                   location,
                   ST_SetSRID(ST_MakePoint($1, $2), 4326)::GEOGRAPHY
               ) as distance_meters
        FROM bubble_note
        WHERE ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::GEOGRAPHY,
            $3
        )
        AND is_valid = 1
        {f"AND status = {status}" if status else ""}
        ORDER BY distance_meters ASC
        LIMIT $4
        """

        # 执行 SQL 查询 (需要使用 postgres_rpc)
        response = client.rpc(
            "get_nearby_bubbles",
            {
                "lon": longitude,
                "lat": latitude,
                "radius_m": int(radius_km * 1000),
                "lim": limit,
                "stat": status
            }
        ).execute()

        if response.data:
            return response.data
        return []

    except Exception as e:
        logger.error(f"获取附近气泡失败: {e}")
        # 如果 RPC 不可用,回退到普通查询 (不含距离)
        return await _get_nearby_bubbles_fallback(longitude, latitude, limit, status)


async def _get_nearby_bubbles_fallback(
    longitude: float,
    latitude: float,
    limit: int = 20,
    status: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    获取附近气泡的降级方案 (不使用 PostGIS, 简单的边界框查询)

    Args:
        longitude: 经度
        latitude: 纬度
        limit: 返回数量限制
        status: 状态筛选

    Returns:
        附近的笔记列表
    """
    try:
        client = db.get_client()

        # 计算边界框 (约1公里)
        delta_lon = 0.01  # 约1公里
        delta_lat = 0.01

        query = client.table("bubble_note").select("*")
        query = query.gte("gps_longitude", longitude - delta_lon)
        query = query.lte("gps_longitude", longitude + delta_lon)
        query = query.gte("gps_latitude", latitude - delta_lat)
        query = query.lte("gps_latitude", latitude + delta_lat)
        query = query.eq("is_valid", 1)

        if status is not None:
            query = query.eq("status", status)

        query = query.order("weight_score", desc=True).limit(limit)
        response = query.execute()

        if response.data:
            return response.data
        return []

    except Exception as e:
        logger.error(f"降级查询失败: {e}")
        return []


async def get_top_bubbles(limit: int = 20, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    获取权重最高的 Top N 气泡

    Args:
        limit: 返回数量限制
        user_id: 用户 ID (可选, 如果指定则只返回该用户的笔记)

    Returns:
        Top 笔记列表
    """
    try:
        client = db.get_client()

        query = client.table("bubble_note").select("*")
        query = query.eq("is_valid", 1)
        query = query.eq("status", 1)  # 只返回公开笔记

        if user_id is not None:
            query = query.eq("user_id", user_id)

        query = query.order("weight_score", desc=True).limit(limit)
        response = query.execute()

        if response.data:
            return response.data
        return []

    except Exception as e:
        logger.error(f"获取 Top 气泡失败: {e}")
        return []


async def delete_bubble_note(note_id: int, user_id: int) -> bool:
    """
    删除气泡笔记 (软删除, 设置 is_valid = 0)

    Args:
        note_id: 笔记 ID
        user_id: 用户 ID

    Returns:
        是否删除成功
    """
    try:
        client = db.get_client(use_admin=True)

        # 先检查权限
        check_response = client.table("bubble_note").select("*").eq("id", note_id).execute()

        if not check_response.data:
            return False

        existing_note = check_response.data[0]
        if existing_note["user_id"] != user_id:
            return False

        # 软删除
        response = client.table("bubble_note").update({"is_valid": 0}).eq("id", note_id).execute()

        if response.data:
            logger.info(f"成功删除气泡笔记, id={note_id}")
            return True
        return False

    except Exception as e:
        logger.error(f"删除气泡笔记失败: {e}")
        return False


# ========================================
# 地灵 AI 处理结果记录相关函数
# ========================================

async def create_genius_loci_record(
    bubble_id: int,
    user_id: int,
    ai_process_type: int,
    ai_result: str,
    model_version: str = "Qwen2.5-7B",
    expire_time: Optional[str] = None,
    gps_longitude: Optional[float] = None,
    gps_latitude: Optional[float] = None
) -> Optional[Dict[str, Any]]:
    """
    创建地灵 AI 处理结果记录

    Args:
        bubble_id: 关联的气泡 ID
        user_id: 用户 ID
        ai_process_type: AI 处理类型（1-分类/2-关键词/3-推荐/4-合规/5-对话总结）
        ai_result: AI 处理结果（JSON 字符串）
        model_version: 模型版本号
        expire_time: 过期时间（可选）
        gps_longitude: 经度（可选，用于地理位置查询）
        gps_latitude: 纬度（可选，用于地理位置查询）

    Returns:
        创建的记录数据，失败则返回 None
    """
    try:
        client = db.get_client(use_admin=True)

        # 构建插入数据
        insert_data = {
            "bubble_id": bubble_id,
            "user_id": user_id,
            "ai_process_type": ai_process_type,
            "ai_result": ai_result,
            "model_version": model_version,
            "is_effective": 1
        }

        if expire_time:
            insert_data["expire_time"] = expire_time

        # 添加经纬度信息（如果提供）
        if gps_longitude is not None:
            insert_data["gps_longitude"] = gps_longitude
        if gps_latitude is not None:
            insert_data["gps_latitude"] = gps_latitude

        response = client.table("genius_loci_record").insert(insert_data).execute()

        if response.data:
            logger.info(f"成功创建地灵AI记录, bubble_id={bubble_id}, user_id={user_id}, type={ai_process_type}")
            return response.data[0]
        else:
            raise Exception("创建记录失败: 无返回数据")

    except Exception as e:
        logger.error(f"创建地灵AI记录失败: {e}")
        return None


async def get_nearby_genius_loci_memory(
    gps_longitude: float,
    gps_latitude: float,
    radius_km: float = 1.0,
    exclude_user_id: Optional[int] = None,  # 保留参数以兼容旧代码，但不使用
    ai_process_type: int = 5  # 5-对话总结
) -> Optional[Dict[str, Any]]:
    """
    获取指定位置附近的地灵对话记忆（最近的一条）

    用于地灵首次对话时检索历史记忆，构建上下文
    注意：地灵会记住所有用户在该位置的记忆，不排除任何用户

    Args:
        gps_longitude: 经度
        gps_latitude: 纬度
        radius_km: 搜索半径（公里），默认 1km
        exclude_user_id: 已废弃，保留以兼容性（地灵记住所有用户的记忆）
        ai_process_type: AI 处理类型，默认为 5（对话总结）

    Returns:
        最近的一条记忆记录，如果没有则返回 None
    """
    try:
        client = db.get_client()

        # 计算边界框（约等于指定半径）
        # 1度约等于111公里，所以 radius_km 对应约 radius_km/111 度
        delta = radius_km / 111.0

        min_lon = gps_longitude - delta
        max_lon = gps_longitude + delta
        min_lat = gps_latitude - delta
        max_lat = gps_latitude + delta

        # 直接查询 genius_loci_record 表（该表已有 gps_longitude 和 gps_latitude 字段）
        # 地灵记住所有用户在该位置的记忆（不排除任何用户）
        query = client.table("genius_loci_record").select("*")
        query = query.gte("gps_longitude", min_lon)
        query = query.lte("gps_longitude", max_lon)
        query = query.gte("gps_latitude", min_lat)
        query = query.lte("gps_latitude", max_lat)
        query = query.eq("ai_process_type", ai_process_type)
        query = query.eq("is_effective", 1)

        # 按处理时间倒序，获取最近的记录
        query = query.order("process_time", desc=True).limit(1)

        response = query.execute()

        if response.data:
            record = response.data[0]
            logger.info(f"✓ 检索到附近地灵记忆: id={record['id']}, bubble_id={record['bubble_id']}, user_id={record['user_id']}")
            return record
        else:
            # 调试：查询所有符合条件的记录（不限制地理位置）
            logger.warning(f"附近 {radius_km}km 内无地灵记忆，开始调试查询...")
            debug_query = client.table("genius_loci_record").select("*")
            debug_query = debug_query.eq("ai_process_type", ai_process_type).eq("is_effective", 1)
            debug_query = debug_query.order("process_time", desc=True).limit(5)

            debug_response = debug_query.execute()
            if debug_response.data:
                logger.info(f"数据库中存在 {len(debug_response.data)} 条地灵记忆记录:")
                for i, rec in enumerate(debug_response.data):
                    logger.info(f"  [{i+1}] id={rec['id']}, gps=({rec.get('gps_longitude')}, {rec.get('gps_latitude')}), user_id={rec['user_id']}, bubble_id={rec.get('bubble_id')}")
            else:
                logger.warning("数据库中不存在任何地灵记忆记录（ai_process_type=5, is_effective=1）")

            logger.info(f"查询范围: longitude[{min_lon:.6f}, {max_lon:.6f}], latitude[{min_lat:.6f}, {max_lat:.6f}]")
            return None

    except Exception as e:
        logger.error(f"检索附近地灵记忆失败: {e}")
        return None


async def get_bubble_genius_loci_records(
    bubble_id: int
) -> List[Dict[str, Any]]:
    """
    获取某个气泡的所有 AI 处理记录

    Args:
        bubble_id: 气泡 ID

    Returns:
        该气泡的 AI 处理记录列表
    """
    try:
        client = db.get_client()

        response = client.table("genius_loci_record") \
            .select("*") \
            .eq("bubble_id", bubble_id) \
            .eq("is_effective", 1) \
            .order("process_time", desc=True) \
            .execute()

        if response.data:
            return response.data
        return []

    except Exception as e:
        logger.error(f"获取气泡AI记录失败: {e}")
        return []


async def get_user_genius_loci_memories(
    user_id: int,
    ai_process_type: Optional[int] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    获取用户的地灵 AI 处理记录列表

    Args:
        user_id: 用户 ID
        ai_process_type: AI 处理类型（可选，不指定则返回所有类型）
        limit: 返回数量限制

    Returns:
        用户的 AI 处理记录列表
    """
    try:
        client = db.get_client()

        query = client.table("genius_loci_record").select("*")
        query = query.eq("user_id", user_id)
        query = query.eq("is_effective", 1)

        if ai_process_type is not None:
            query = query.eq("ai_process_type", ai_process_type)

        query = query.order("process_time", desc=True).limit(limit)

        response = query.execute()

        if response.data:
            return response.data
        return []

    except Exception as e:
        logger.error(f"获取用户AI记录失败: {e}")
        return []


async def get_ai_summary_by_bubble_id(
    bubble_id: int,
    user_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    根据 bubble_id 查询 AI 总结（从 genius_loci_record 表）

    Args:
        bubble_id: 气泡笔记 ID
        user_id: 用户 ID（可选，用于权限验证）

    Returns:
        AI 记录字典，包含 ai_result 字段；如果不存在或未生成则返回 None
    """
    try:
        client = db.get_client()

        # 构建查询
        query = client.table("genius_loci_record").select("*")
        query = query.eq("bubble_id", bubble_id)
        query = query.eq("ai_process_type", 5)  # 5-对话总结
        query = query.eq("is_effective", 1)  # 只查询有效记录

        # 如果指定了 user_id，进行权限验证
        if user_id is not None:
            query = query.eq("user_id", user_id)

        # 按处理时间倒序，获取最新的总结
        query = query.order("process_time", desc=True).limit(1)

        response = query.execute()

        if response.data:
            record = response.data[0]
            logger.info(f"找到 AI 总结记录: bubble_id={bubble_id}, record_id={record['id']}")

            # 检查 ai_result 是否为空
            if not record.get("ai_result"):
                logger.warning(f"AI 总结内容为空: bubble_id={bubble_id}")
                return None

            return record
        else:
            logger.info(f"未找到 AI 总结记录: bubble_id={bubble_id}")
            return None

    except Exception as e:
        logger.error(f"查询 AI 总结失败: {e}")
        return None


# ========================================
# 测试代码
# ========================================

if __name__ == "__main__":
    # 测试数据库连接
    print("测试 Supabase 连接...")

    try:
        # 测试查询
        result = db.client.table("bubble_note").select("*").limit(1).execute()
        print(f"连接成功! 查询结果: {result.data}")
    except Exception as e:
        print(f"连接失败: {e}")
