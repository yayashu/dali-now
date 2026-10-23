# 数据库说明

## 基本信息

| 项 | 值 |
|---|---|
| 数据库 | MySQL >= 8.0 / MariaDB |
| 库名 | `dali_now` |
| 字符集 | `utf8mb4` |
| 连接配置 | 环境变量 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`（见 `.env.example`） |

## 表清单（23 张）

| 表名 | 说明 |
|---|---|
| `activities` | 活动 |
| `activity_images` | 活动图片 |
| `activity_tags` | 活动标签 |
| `activity_types` | 活动类型 |
| `checkin_points` | 打卡点 |
| `checkin_photos` | 打卡照片 |
| `live_posts` | 现场动态 |
| `live_post_images` | 现场动态图片 |
| `community_posts` | 社区帖子 |
| `community_tags` | 社区标签 |
| `homepage_photos` | 首页照片 |
| `local_life_categories` | 本地生活分类 |
| `local_life_items` | 本地生活条目 |
| `users` | 用户 |
| `user_bookings` | 用户活动预约 |
| `user_checkins` | 用户打卡记录 |
| `user_favorites` | 用户收藏 |
| `user_likes` | 用户点赞 |
| `search_history` | 搜索历史 |
| `app_config` | 应用配置（KV） |
| `scenic_spots` | 景点 |
| `sensitive_words` | 敏感词库 |
| `districts` | 区县 |

> 表名常量统一定义在 `services/server/config.py` 的 `TABLES` 中，Python 侧请通过常量引用。

## 初始化

### 方式一：Node.js 脚本（推荐）

```bash
cd services/server
npm run init-db                       # 建库 + 建表
node scripts/init-sensitive-words.js  # 单独初始化敏感词
```

### 方式二：手动 SQL

```bash
mysql -u root -p -e "CREATE DATABASE dali_now DEFAULT CHARSET utf8mb4"
mysql -u root -p dali_now < services/server/sql/schema_mysql.sql
```

### 种子数据

```bash
python services/server/scripts/import_seed.py       # 导入种子数据（含 images/ 目录图片）
```

## 迁移脚本

| 脚本 | 用途 |
|---|---|
| `services/server/sql/migrate_activity_types.sql` | 活动类型表迁移 |
| `services/server/sql/migrate_live_posts_points.sql` | 现场动态/打卡点字段迁移 |
| `services/server/scripts/migrate_scenic_spots.sql` | 景点模块迁移 |
| `services/server/scripts/migrate_user_status.sql` | 用户状态字段迁移 |
| `services/server/scripts/migrate_activity_coords.py` | 活动坐标数据迁移 |
| `services/server/scripts/migrate_privacy.py` | 隐私协议数据迁移 |
| `services/server/scripts/migrate_publish_status.py` | 发布状态数据迁移 |
| `services/server/scripts/migrate_review_status.py` | 审核状态数据迁移 |

## 运维常用命令

```bash
mysql -u dali_app -p dali_now
SELECT COUNT(*) FROM users;                            # 用户数
SELECT COUNT(*) FROM activities WHERE status='active'; # 活跃活动数
SHOW PROCESSLIST;                                      # 当前连接
```
