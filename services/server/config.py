# -*- coding: utf-8 -*-
"""
大理此刻 - 全局配置（Python 侧）
============================================
所有配置项统一管理，敏感信息优先从环境变量读取。
"""
import os
import pymysql.cursors

# ============================================================
# 数据库配置（优先从环境变量读取，带默认值兜底）
# ============================================================
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'port': int(os.environ.get('DB_PORT', 3306)),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'dali_now'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    'autocommit': True
}

# ============================================================
# 服务配置
# ============================================================
SERVER_HOST = '0.0.0.0'
SERVER_PORT = int(os.environ.get('SERVER_PORT', 5000))
MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20MB

# ============================================================
# 上传配置
# ============================================================
UPLOAD_DIR = os.environ.get('UPLOAD_DIR', os.path.join(os.path.expanduser('~'), 'dali_uploads'))
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'images')

# ============================================================
# 管理员认证
# ============================================================
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')
ADMIN_SECRET = os.environ.get('ADMIN_SECRET', '')

# ============================================================
# 敏感词过滤
# ============================================================
MIN_MATCH_LENGTH = 2
DEFAULT_SENSITIVE_FIELDS = [
    'content', 'note', 'nickname', 'name', 'user_name',
    'activity_name', 'location', 'keyword', 'title', 'description', 'comment'
]

# ============================================================
# 分页默认值
# ============================================================
DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 10000

# ============================================================
# 图片处理参数
# ============================================================
IMAGE_PROFILES = {
    'cover':   {'max_width': 1200, 'max_height': 2400, 'quality': 85},
    'gallery': {'max_width': 1200, 'max_height': 2400, 'quality': 82},
    'thumb':   {'max_width': 600,  'max_height': 1200, 'quality': 80},
}

# ============================================================
# 微信小程序配置
# ============================================================
WECHAT_APPID = os.environ.get('WECHAT_APPID', '')
WECHAT_SECRET = os.environ.get('WECHAT_SECRET', '')

# ============================================================
# API 防滥用密钥（小程序端与服务端共享，用于请求签名）
# ============================================================
API_SECRET = os.environ.get('API_SECRET', '')
SIGNATURE_WINDOW_SECONDS = 300  # 签名时间窗口 ±5分钟

# 频率限制
RATE_LIMIT_GENERAL = os.environ.get('RATE_LIMIT_GENERAL', '100 per minute')
RATE_LIMIT_SEARCH = os.environ.get('RATE_LIMIT_SEARCH', '30 per minute')

# ============================================================
# 默认值
# ============================================================
DEFAULT_NICKNAME = u'旅行者·大理'

# ============================================================
# 表名常量
# ============================================================
TABLES = {
    'ACTIVITIES': 'activities',
    'ACTIVITY_IMAGES': 'activity_images',
    'ACTIVITY_TAGS': 'activity_tags',
    'ACTIVITY_TYPES': 'activity_types',
    'CHECKIN_POINTS': 'checkin_points',
    'CHECKIN_PHOTOS': 'checkin_photos',
    'LIVE_POSTS': 'live_posts',
    'LIVE_POST_IMAGES': 'live_post_images',
    'COMMUNITY_POSTS': 'community_posts',
    'COMMUNITY_TAGS': 'community_tags',
    'HOMEPAGE_PHOTOS': 'homepage_photos',
    'LOCAL_LIFE_CATEGORIES': 'local_life_categories',
    'LOCAL_LIFE_ITEMS': 'local_life_items',
    'USERS': 'users',
    'USER_BOOKINGS': 'user_bookings',
    'USER_CHECKINS': 'user_checkins',
    'USER_FAVORITES': 'user_favorites',
    'USER_LIKES': 'user_likes',
    'SCENIC_SPOTS': 'scenic_spots',
    'SEARCH_HISTORY': 'search_history',
    'APP_CONFIG': 'app_config',
    'SENSITIVE_WORDS': 'sensitive_words',
    'DISTRICTS': 'districts',
}
