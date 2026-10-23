-- ============================================================
-- 大理此刻 (DaLiNow) 数据库设计 - MySQL 版本
-- 数据库: MySQL 8.0+
-- 编码: UTF-8MB4
-- 设计日期: 2026-06-04
-- ============================================================

CREATE DATABASE IF NOT EXISTS dali_now DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dali_now;

-- ============================================================
-- 一、核心业务表
-- ============================================================

-- 1. 区域/区县表
CREATE TABLE IF NOT EXISTS districts (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    code        VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    sort_order  INT DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 活动表
CREATE TABLE IF NOT EXISTS activities (
    id              VARCHAR(20) PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(20)  NOT NULL DEFAULT 'folk',
    type_name       VARCHAR(50),
    cover           TEXT,
    poster          TEXT,
    date            VARCHAR(20)  NOT NULL,
    time            VARCHAR(50),
    time_range      VARCHAR(50),
    location        VARCHAR(200),
    latitude        DECIMAL(12,8),
    longitude       DECIMAL(12,8),
    district_code   VARCHAR(50),
    price           DECIMAL(10,2) DEFAULT 0,
    price_text      VARCHAR(50)   DEFAULT '免费',
    is_free         TINYINT       DEFAULT 1,
    capacity        INT           DEFAULT 0,
    remaining       INT           DEFAULT 0,
    booked          INT           DEFAULT 0,
    hot_value       INT           DEFAULT 0,
    description     TEXT,
    culture_intro   TEXT,
    organizer       VARCHAR(200),
    traffic         TEXT,
    notes           TEXT,
    rules           TEXT,
    status          VARCHAR(20)   DEFAULT 'active',
    date_range_start VARCHAR(20),
    date_range_end  VARCHAR(20),
    duration_days   INT DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activities_district (district_code),
    INDEX idx_activities_status (status),
    INDEX idx_activities_date (date),
    INDEX idx_activities_hot (hot_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 活动标签表
CREATE TABLE IF NOT EXISTS activity_tags (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    activity_id VARCHAR(20) NOT NULL,
    tag         VARCHAR(100) NOT NULL,
    INDEX idx_activity_tags_aid (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 活动图片表
CREATE TABLE IF NOT EXISTS activity_images (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    activity_id VARCHAR(20) NOT NULL,
    image_url   TEXT NOT NULL,
    sort_order  INT DEFAULT 0,
    is_cover    TINYINT DEFAULT 0,
    INDEX idx_activity_images_aid (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 打卡点表
CREATE TABLE IF NOT EXISTS checkin_points (
    id              VARCHAR(20) PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(20) NOT NULL DEFAULT 'activity',
    activity_id     VARCHAR(20),
    cover           TEXT,
    latitude        DOUBLE NOT NULL,
    longitude       DOUBLE NOT NULL,
    description     TEXT,
    angle           VARCHAR(200),
    composition     VARCHAR(200),
    best_time       VARCHAR(100),
    crowd_level     VARCHAR(20) DEFAULT '舒适',
    crowd_peak      VARCHAR(100),
    crowd_morning   VARCHAR(20) DEFAULT '舒适',
    crowd_noon      VARCHAR(20) DEFAULT '舒适',
    crowd_afternoon VARCHAR(20) DEFAULT '舒适',
    crowd_evening   VARCHAR(20) DEFAULT '舒适',
    tips            TEXT,
    taboos          TEXT,
    landmark        VARCHAR(200),
    popularity      INT DEFAULT 0,
    popularity_text VARCHAR(50),
    charge_type     VARCHAR(20) DEFAULT 'free',
    charge_price    VARCHAR(50),
    charge_note     TEXT,
    distance        DOUBLE DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_checkin_points_aid (activity_id),
    INDEX idx_checkin_points_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 二、内容/社区表
-- ============================================================

-- 6. 现场发文表
CREATE TABLE IF NOT EXISTS live_posts (
    id              VARCHAR(20) PRIMARY KEY,
    user_id         VARCHAR(50) DEFAULT '',
    activity_id     VARCHAR(20),
    activity_name   VARCHAR(200),
    user_name       VARCHAR(100) NOT NULL,
    user_avatar     TEXT,
    type            VARCHAR(20) DEFAULT 'image',
    content         TEXT,
    cover           TEXT,
    video_url       TEXT,
    point_id        VARCHAR(20) DEFAULT '',
    point_name      VARCHAR(200) DEFAULT '',
    location        VARCHAR(200),
    post_time       VARCHAR(20),
    post_date       VARCHAR(20),
    like_count      INT DEFAULT 0,
    comment_count   INT DEFAULT 0,
    share_count     INT DEFAULT 0,
    is_verified     TINYINT DEFAULT 1,
    is_hidden       TINYINT DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_live_posts_aid (activity_id),
    INDEX idx_live_posts_date (post_date),
    INDEX idx_live_posts_time (post_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 现场发文图片表
CREATE TABLE IF NOT EXISTS live_post_images (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    post_id     VARCHAR(20) NOT NULL,
    image_url   TEXT NOT NULL,
    sort_order  INT DEFAULT 0,
    INDEX idx_live_post_images_pid (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 社区攻略帖表
CREATE TABLE IF NOT EXISTS community_posts (
    id              VARCHAR(20) PRIMARY KEY,
    user_name       VARCHAR(100) NOT NULL,
    user_avatar     TEXT,
    title           VARCHAR(200) NOT NULL,
    cover           TEXT,
    content         TEXT,
    post_date       VARCHAR(20),
    like_count      INT DEFAULT 0,
    comment_count   INT DEFAULT 0,
    view_count      INT DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. 社区帖标签表
CREATE TABLE IF NOT EXISTS community_tags (
    id      INT PRIMARY KEY AUTO_INCREMENT,
    post_id VARCHAR(20) NOT NULL,
    tag     VARCHAR(100) NOT NULL,
    INDEX idx_community_tags_pid (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 三、照片/打卡记录表
-- ============================================================

-- 10. 打卡照片表
CREATE TABLE IF NOT EXISTS checkin_photos (
    id              VARCHAR(20) PRIMARY KEY,
    checkin_id      VARCHAR(20) NOT NULL,
    user_name       VARCHAR(100) NOT NULL,
    user_avatar     TEXT,
    image_url       TEXT NOT NULL,
    shoot_date      VARCHAR(20),
    shoot_time      VARCHAR(20),
    weather         VARCHAR(50),
    temperature     VARCHAR(20),
    device          VARCHAR(100),
    lens            VARCHAR(100),
    description     TEXT,
    like_count      INT DEFAULT 0,
    is_liked        TINYINT DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_checkin_photos_cid (checkin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. 首页照片墙表
CREATE TABLE IF NOT EXISTS homepage_photos (
    id          VARCHAR(20) PRIMARY KEY,
    image_url   TEXT NOT NULL,
    user_name   VARCHAR(100),
    user_avatar TEXT,
    shoot_date  VARCHAR(20),
    weather     VARCHAR(50),
    temperature VARCHAR(20),
    like_count  INT DEFAULT 0,
    is_liked    TINYINT DEFAULT 0,
    sort_order  INT DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 四、本地生活表
-- ============================================================

-- 12. 本地生活分类表
CREATE TABLE IF NOT EXISTS local_life_categories (
    id   INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. 本地生活项目表
CREATE TABLE IF NOT EXISTS local_life_items (
    id          VARCHAR(20) PRIMARY KEY,
    category    VARCHAR(50) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    cover       TEXT,
    item_type   VARCHAR(50),
    rating      DECIMAL(2,1) DEFAULT 0,
    price       VARCHAR(50),
    location    VARCHAR(200),
    description TEXT,
    sort_order  INT DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_local_life_items_cat (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 五、用户系统表
-- ============================================================

-- 14. 用户表
CREATE TABLE IF NOT EXISTS users (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    openid       VARCHAR(100) UNIQUE,
    nickname     VARCHAR(100) DEFAULT '旅行者·大理',
    avatar       TEXT,
    phone        VARCHAR(20),
    token        VARCHAR(200),
    is_logged_in   TINYINT DEFAULT 0,
    privacy_agreed TINYINT DEFAULT 0,
    privacy_agreed_at DATETIME,
    status        VARCHAR(20) DEFAULT 'active' COMMENT 'active=正常, disabled=禁用, muted=禁闭',
    ban_until     DATETIME DEFAULT NULL COMMENT '禁闭截止时间',
    ban_reason    VARCHAR(500) DEFAULT NULL COMMENT '封禁原因',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. 用户活动预约表
CREATE TABLE IF NOT EXISTS user_bookings (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT,
    activity_id VARCHAR(20),
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    count       INT DEFAULT 1,
    status      VARCHAR(20) DEFAULT 'pending',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_bookings_uid (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. 用户打卡记录表
CREATE TABLE IF NOT EXISTS user_checkins (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    user_id     INT,
    checkin_id  VARCHAR(20),
    image_url   TEXT,
    note        TEXT,
    latitude    DOUBLE,
    longitude   DOUBLE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_checkins_uid (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT,
    item_type  VARCHAR(20) NOT NULL,
    item_id    VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_favorites_uid (user_id),
    UNIQUE KEY uk_user_fav (user_id, item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. 用户点赞表
CREATE TABLE IF NOT EXISTS user_likes (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT,
    item_type  VARCHAR(20) NOT NULL,
    item_id    VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_likes_uid (user_id),
    UNIQUE KEY uk_user_like (user_id, item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT,
    keyword    VARCHAR(200) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_search_history_uid (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 六、应用配置表
-- ============================================================

-- 20. 应用配置键值表
CREATE TABLE IF NOT EXISTS app_config (
    `key`      VARCHAR(100) PRIMARY KEY,
    `value`    TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 七、初始化种子数据
-- ============================================================

-- 区域数据
INSERT IGNORE INTO districts (code, name, sort_order) VALUES
    ('all',       '大理全域', 0),
    ('dali',      '大理市',   1),
    ('eryuan',    '洱源县',   2),
    ('jianchuan', '剑川县',   3),
    ('heqing',    '鹤庆县',   4),
    ('yangbi',    '漾濞县',   5),
    ('xiangyun',  '祥云县',   6),
    ('binchuan',  '宾川县',   7),
    ('midu',      '弥渡县',   8),
    ('nanjian',   '南涧县',   9),
    ('weishan',   '巍山县',  10),
    ('yongping',  '永平县',  11),
    ('yunlong',   '云龙县',  12);

-- 本地生活分类
INSERT IGNORE INTO local_life_categories (code, name) VALUES
    ('food',  '美食'),
    ('hotel', '住宿'),
    ('shop',  '好物');

-- 应用配置
INSERT IGNORE INTO app_config (`key`, `value`) VALUES
    ('db_version', '1.0');
