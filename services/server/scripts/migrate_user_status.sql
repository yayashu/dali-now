-- ============================================================
-- 用户状态管理迁移
-- 新增字段: status (禁用/禁闭), ban_until (禁闭截止), ban_reason
-- 执行: mysql -u root -p <database> < scripts/migrate_user_status.sql
-- ============================================================

ALTER TABLE users
  ADD COLUMN status     VARCHAR(20)  DEFAULT 'active' COMMENT '用户状态: active=正常, disabled=禁用, muted=禁闭',
  ADD COLUMN ban_until  DATETIME     DEFAULT NULL COMMENT '禁闭截止时间, NULL=无/永久',
  ADD COLUMN ban_reason VARCHAR(500) DEFAULT NULL COMMENT '封禁原因';

-- 为已有用户设置默认值
UPDATE users SET status = 'active' WHERE status IS NULL;

-- 添加索引加速状态查询
ALTER TABLE users ADD INDEX idx_users_status (status);
