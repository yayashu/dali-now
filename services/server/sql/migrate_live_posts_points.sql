-- ============================================================
-- 迁移：给 live_posts 表新增打卡点关联字段
-- 修复"清除缓存后关联打卡地点消失"的 bug
-- ============================================================
-- 执行方式：mysql -u root -p your_db_name < scripts/migrate_live_posts_points.sql
-- 或直接在 MySQL 客户端中执行以下两条语句
-- ============================================================

-- 增加 point_id（打卡点ID），仅当列不存在时添加
SET @sql_point_id = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_posts' AND COLUMN_NAME = 'point_id') = 0,
  'ALTER TABLE live_posts ADD COLUMN point_id VARCHAR(20) DEFAULT "" AFTER video_url',
  'SELECT "point_id 列已存在，跳过" AS msg'
);
PREPARE stmt FROM @sql_point_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 增加 point_name（打卡点名称），仅当列不存在时添加
SET @sql_point_name = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_posts' AND COLUMN_NAME = 'point_name') = 0,
  'ALTER TABLE live_posts ADD COLUMN point_name VARCHAR(200) DEFAULT "" AFTER point_id',
  'SELECT "point_name 列已存在，跳过" AS msg'
);
PREPARE stmt FROM @sql_point_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
