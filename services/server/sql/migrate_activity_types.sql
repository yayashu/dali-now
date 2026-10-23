-- 活动类型字典表
CREATE TABLE IF NOT EXISTS activity_types (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    code        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    sort_order  INT DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 种子数据：大理常见活动类型
INSERT IGNORE INTO activity_types (code, name, sort_order) VALUES
    ('folk',       '民俗活动', 1),
    ('cultural',   '文化体验', 2),
    ('outdoor',    '户外运动', 3),
    ('food',       '美食体验', 4),
    ('festival',   '节庆活动', 5),
    ('art',        '艺术展览', 6),
    ('nature',     '自然观光', 7),
    ('handcraft',  '手作体验', 8),
    ('performance','演出表演', 9),
    ('other',      '其他活动', 99);
