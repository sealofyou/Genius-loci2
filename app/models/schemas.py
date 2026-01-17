"""
Pydantic 数据模型
定义请求和响应的数据结构
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, validator


# ========================================
# 请求模型
# ========================================

class BubbleNoteCreate(BaseModel):
    """创建气泡笔记请求模型 (JSON 格式, 不含图片)"""

    # 用户 ID (从 JWT 中解析, 这里也允许传入)
    user_id: int = Field(..., description="用户 ID")

    # 笔记内容
    content: Optional[str] = Field(None, description="笔记文本内容")

    # 地理坐标 (必填)
    gps_longitude: float = Field(..., description="经度 [-180, 180]")
    gps_latitude: float = Field(..., description="纬度 [-90, 90]")

    # 笔记状态 (可选, 默认为公开)
    status: int = Field(1, description="笔记状态 (1-公开/2-私有)")

    note_type: Optional[int] = Field(3, description="笔记类型 (1-图文/2-纯文本/3-对话)")

    # note_id 可选 (如果存在则为更新模式)
    note_id: Optional[int] = Field(None, description="笔记 ID (更新模式时必填)")

    @validator('gps_longitude')
    def validate_longitude(cls, v):
        """校验经度范围"""
        if not -180 <= v <= 180:
            raise ValueError('经度必须在 [-180, 180] 范围内')
        return v

    @validator('gps_latitude')
    def validate_latitude(cls, v):
        """校验纬度范围"""
        if not -90 <= v <= 90:
            raise ValueError('纬度必须在 [-90, 90] 范围内')
        return v

    @validator('status')
    def validate_status(cls, v):
        """校验状态值"""
        if v not in [1, 2, 3]:
            raise ValueError('状态必须为 1 (公开) 或 2 (私有)或3(对话)')
        return v

    @validator('content')
    def validate_content(cls, v, values):
        """校验内容完整性 (文本与图片不可同时为空)"""
        # 注意: images 字段在后续的 API 路由中处理
        # 这里主要校验 content 字段本身
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "content": "今天天气真好!",
                "gps_longitude": 120.15507,
                "gps_latitude": 30.27408,
                "status": 1
            }
        }


class BubbleNoteUpdate(BaseModel):
    """更新气泡笔记请求模型 (JSON 格式, 不含图片)"""

    note_id: int = Field(..., description="笔记 ID")
    user_id: int = Field(..., description="用户 ID (用于权限验证)")

    # 可更新的字段
    content: Optional[str] = Field(None, description="笔记文本内容")
    gps_longitude: Optional[float] = Field(None, description="经度")
    gps_latitude: Optional[float] = Field(None, description="纬度")
    status: Optional[int] = Field(None, description="笔记状态")

    @validator('gps_longitude')
    def validate_longitude(cls, v):
        """校验经度范围"""
        if v is not None and not -180 <= v <= 180:
            raise ValueError('经度必须在 [-180, 180] 范围内')
        return v

    @validator('gps_latitude')
    def validate_latitude(cls, v):
        """校验纬度范围"""
        if v is not None and not -90 <= v <= 90:
            raise ValueError('纬度必须在 [-90, 90] 范围内')
        return v

    @validator('status')
    def validate_status(cls, v):
        """校验状态值"""
        if v is not None and v not in [1, 2]:
            raise ValueError('状态必须为 1 (公开) 或 2 (私有)')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "note_id": 1,
                "user_id": 1,
                "content": "更新后的内容",
                "gps_longitude": 120.15507,
                "gps_latitude": 30.27408
            }
        }


class GetNearbyBubblesRequest(BaseModel):
    """获取附近气泡请求模型"""

    longitude: float = Field(..., description="中心点经度")
    latitude: float = Field(..., description="中心点纬度")
    radius_km: float = Field(1.0, description="搜索半径 (公里)")
    limit: int = Field(20, description="返回数量限制")
    status: Optional[int] = Field(None, description="状态筛选 (1-公开/2-私有/3-对话)")

    @validator('longitude')
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('经度必须在 [-180, 180] 范围内')
        return v

    @validator('latitude')
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('纬度必须在 [-90, 90] 范围内')
        return v

    @validator('radius_km')
    def validate_radius(cls, v):
        if v <= 0 or v > 100:
            raise ValueError('半径必须在 (0, 100] 公里范围内')
        return v

    @validator('limit')
    def validate_limit(cls, v):
        if v <= 0 or v > 100:
            raise ValueError('返回数量必须在 (0, 100] 范围内')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "longitude": 120.15507,
                "latitude": 30.27408,
                "radius_km": 1.0,
                "limit": 20,
                "status": 1
            }
        }


# ========================================
# 响应模型
# ========================================

class BubbleNoteResponse(BaseModel):
    """气泡笔记响应模型"""

    id: int
    user_id: int
    note_type: int
    content: str
    image_urls: Optional[str] = None
    gps_longitude: float
    gps_latitude: float
    status: int
    emotion: str
    create_time: datetime
    update_time: datetime
    weight_score: float
    is_valid: int

    # 额外字段 (用于附近查询)
    distance_meters: Optional[float] = Field(None, description="距离 (米)")

    class Config:
        from_attributes = True  # Pydantic v2
        json_schema_extra = {
            "example": {
                "id": 1,
                "user_id": 1,
                "note_type": 1,
                "content": "今天天气真好!",
                "image_urls": "https://example.com/image1.jpg,https://example.com/image2.jpg",
                "gps_longitude": 120.15507,
                "gps_latitude": 30.27408,
                "status": 1,
                "emotion": "开心",
                "create_time": "2025-01-17T12:00:00",
                "update_time": "2025-01-17T12:00:00",
                "weight_score": 95.50,
                "is_valid": 1,
                "distance_meters": 156.3
            }
        }


class ApiResponse(BaseModel):
    """通用 API 响应模型"""

    code: int = Field(200, description="状态码 (200-成功/400-客户端错误/500-服务器错误)")
    message: str = Field("success", description="响应消息")
    data: Optional[dict] = Field(None, description="响应数据")

    class Config:
        json_schema_extra = {
            "example": {
                "code": 200,
                "message": "操作成功",
                "data": {
                    "note_id": 1,
                    "emotion": "开心"
                }
            }
        }


class ErrorResponse(BaseModel):
    """错误响应模型"""

    code: int = Field(..., description="错误码")
    message: str = Field(..., description="错误消息")
    detail: Optional[str] = Field(None, description="详细错误信息")

    class Config:
        json_schema_extra = {
            "example": {
                "code": 400,
                "message": "请求参数错误",
                "detail": "经纬度范围不合法"
            }
        }


# ========================================
# 列表响应模型
# ========================================

class BubbleNoteListResponse(BaseModel):
    """气泡笔记列表响应"""

    code: int = 200
    message: str = "success"
    data: List[BubbleNoteResponse]
    total: int = Field(0, description="总数")

    class Config:
        json_schema_extra = {
            "example": {
                "code": 200,
                "message": "success",
                "data": [],
                "total": 0
            }
        }


# ========================================
# 地灵对话请求/响应模型
# ========================================

class GeniusLociChatRequest(BaseModel):
    """地灵对话请求模型"""

    user_id: int = Field(..., description="用户 ID")
    message: str = Field(..., description="用户消息内容")
    gps_longitude: float = Field(..., description="经度 [-180, 180]")
    gps_latitude: float = Field(..., description="纬度 [-90, 90]")
    session_id: Optional[str] = Field(None, description="会话 ID（首次对话时为空）")
    image_url: Optional[str] = Field(None, description="图片 URL（首次对话时传入）")

    @validator('gps_longitude')
    def validate_longitude(cls, v):
        """校验经度范围"""
        if not -180 <= v <= 180:
            raise ValueError('经度必须在 [-180, 180] 范围内')
        return v

    @validator('gps_latitude')
    def validate_latitude(cls, v):
        """校验纬度范围"""
        if not -90 <= v <= 90:
            raise ValueError('纬度必须在 [-90, 90] 范围内')
        return v

    @validator('message')
    def validate_message(cls, v):
        """校验消息内容"""
        if not v or not v.strip():
            raise ValueError('消息内容不能为空')
        return v.strip()

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "message": "你好，今天天气真好！",
                "gps_longitude": 120.15507,
                "gps_latitude": 30.27408,
                "session_id": None,
                "image_url": "https://example.com/image.jpg"
            }
        }


class GeniusLociChatResponse(BaseModel):
    """地灵对话响应模型"""

    code: int = Field(200, description="状态码")
    message: str = Field("success", description="响应消息")
    session_id: str = Field(..., description="会话 ID")
    data: Optional[dict] = Field(None, description="其他数据")

    class Config:
        json_schema_extra = {
            "example": {
                "code": 200,
                "message": "success",
                "session_id": "uuid-string",
                "data": None
            }
        }


class GeniusLociRecordResponse(BaseModel):
    """地灵记忆记录响应模型"""

    id: int
    user_id: int
    session_id: str
    ai_result: str
    gps_longitude: float
    gps_latitude: float
    create_time: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "user_id": 1,
                "session_id": "uuid-string",
                "ai_result": "用户表达了对天气的喜悦，地灵回应以温暖的问候",
                "gps_longitude": 120.15507,
                "gps_latitude": 30.27408,
                "create_time": "2025-01-17T12:00:00"
            }
        }

# ========================================
# AI 总结查询请求/响应模型
# ========================================

class GetAISummaryRequest(BaseModel):
    """获取笔记 AI 总结请求模型"""

    note_id: int = Field(..., description="笔记 ID (bubble_note.id)")
    user_id: int = Field(..., description="用户 ID（用于权限验证）")

    @validator('note_id')
    def validate_note_id(cls, v):
        """校验 note_id"""
        if v <= 0:
            raise ValueError('笔记 ID 必须为正整数')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "note_id": 123,
                "user_id": 1
            }
        }


class AISummaryResponse(BaseModel):
    """AI 总结响应模型"""

    code: int = Field(200, description="状态码 (200-成功/202-处理中/404-未找到)")
    message: str = Field("success", description="响应消息")
    data: Optional[dict] = Field(None, description="总结数据")

    class Config:
        json_schema_extra = {
            "example": {
                "code": 200,
                "message": "success",
                "data": {
                    "note_id": 123,
                    "ai_result": {
                        "summary": "用户表达了对天气的喜悦，地灵回应以温暖的问候...",
                        "turns": 5,
                        "session_id": "uuid-string"
                    },
                    "process_time": "2025-01-17T12:00:00",
                    "model_version": "gpt-4"
                }
            }
        }

