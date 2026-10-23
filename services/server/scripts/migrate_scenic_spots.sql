-- ============================================================
-- 大理此刻 - 景区管理功能数据库迁移
-- ============================================================
-- 执行方式: mysql -u root -p dali_now < scripts/migrate_scenic_spots.sql
-- 设计日期: 2026-06-16
-- ============================================================

-- 1. 创建景区表
CREATE TABLE IF NOT EXISTS scenic_spots (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(200) NOT NULL,                     -- 景区名称
    district_code   VARCHAR(50) DEFAULT NULL,                  -- 所属区域 code
    cover           TEXT,                                      -- 封面图 URL
    images          JSON DEFAULT NULL,                         -- 多图片 [{"url":"...","desc":"..."}]
    description     TEXT,                                      -- 景区简介
    overview        TEXT,                                      -- 景区概况（长文本）
    entrance        VARCHAR(500) DEFAULT NULL,                 -- 入口描述
    entrance_lat    DOUBLE DEFAULT NULL,                       -- 入口纬度
    entrance_lng    DOUBLE DEFAULT NULL,                       -- 入口经度
    parking         TEXT,                                      -- 停车场信息
    parking_lat     DOUBLE DEFAULT NULL,                       -- 停车场纬度
    parking_lng     DOUBLE DEFAULT NULL,                       -- 停车场经度
    parking_fee     VARCHAR(100) DEFAULT NULL,                 -- 停车费
    ticket_type     VARCHAR(20) DEFAULT 'free',                -- 门票类型: free/paid
    ticket_price    DECIMAL(10,2) DEFAULT 0.00,                -- 门票价格(元)
    ticket_note     TEXT,                                      -- 票价补充说明
    half_price_note TEXT,                                      -- 优惠政策
    open_time       VARCHAR(200) DEFAULT NULL,                 -- 开放时间
    close_time      VARCHAR(200) DEFAULT NULL,                 -- 关闭时间
    best_season     VARCHAR(200) DEFAULT NULL,                 -- 最佳游览季节
    suggested_time  VARCHAR(100) DEFAULT NULL,                 -- 建议游览时长
    address         VARCHAR(500) DEFAULT NULL,                 -- 详细地址
    latitude        DOUBLE DEFAULT NULL,                       -- 景区中心纬度
    longitude       DOUBLE DEFAULT NULL,                       -- 景区中心经度
    phone           VARCHAR(50) DEFAULT NULL,                  -- 联系电话
    website         VARCHAR(200) DEFAULT NULL,                 -- 官网
    level           VARCHAR(20) DEFAULT NULL,                  -- 景区级别: 5A/4A/3A/2A/A
    tags            VARCHAR(500) DEFAULT NULL,                 -- 标签（逗号分隔）
    facilities      TEXT,                                      -- 配套设施
    transport       TEXT,                                      -- 交通指南
    notice          TEXT,                                      -- 注意事项
    tips            TEXT,                                      -- 游览贴士
    popularity      INT DEFAULT 0,                             -- 热度值
    status          VARCHAR(20) DEFAULT 'active',              -- active/inactive
    sort_order      INT DEFAULT 0,                             -- 排序权重
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_scenic_spots_name (name),
    INDEX idx_scenic_spots_district (district_code),
    INDEX idx_scenic_spots_status (status),
    INDEX idx_scenic_spots_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 打卡点表增加所属景区字段（兼容 MySQL 5.7+，用存储过程判断是否存在）
DROP PROCEDURE IF EXISTS migrate_checkin_points;
DELIMITER $$
CREATE PROCEDURE migrate_checkin_points()
BEGIN
    -- 添加 scenic_spot_id 列（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'checkin_points'
          AND COLUMN_NAME = 'scenic_spot_id'
    ) THEN
        ALTER TABLE checkin_points ADD COLUMN scenic_spot_id INT DEFAULT NULL AFTER activity_id;
    END IF;

    -- 添加索引（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'checkin_points'
          AND INDEX_NAME = 'idx_checkin_points_ssid'
    ) THEN
        ALTER TABLE checkin_points ADD INDEX idx_checkin_points_ssid (scenic_spot_id);
    END IF;
END$$
DELIMITER ;
CALL migrate_checkin_points();
DROP PROCEDURE migrate_checkin_points;
