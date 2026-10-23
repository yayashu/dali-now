# -*- coding: utf-8 -*-
"""数据库迁移：添加 publish_status 字段（上架/下架）"""
import pymysql
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

conn = pymysql.connect(**DB_CONFIG)
conn.autocommit(True)
cur = conn.cursor()

try:
    # checkin_points
    cur.execute("ALTER TABLE checkin_points ADD COLUMN publish_status VARCHAR(20) DEFAULT 'listed' AFTER review_status")
    print("checkin_points: added publish_status (DEFAULT 'listed')")
except Exception as e:
    if 'Duplicate' in str(e):
        print("checkin_points: publish_status already exists, skipped")
    else:
        print(f"checkin_points error: {e}")

try:
    # checkin_points index
    cur.execute("CREATE INDEX idx_checkin_points_publish ON checkin_points(publish_status)")
    print("checkin_points: index created")
except Exception as e:
    if 'Duplicate' in str(e):
        print("checkin_points: index already exists, skipped")
    else:
        print(f"checkin_points index error: {e}")

try:
    # activities
    cur.execute("ALTER TABLE activities ADD COLUMN publish_status VARCHAR(20) DEFAULT 'listed' AFTER review_status")
    print("activities: added publish_status (DEFAULT 'listed')")
except Exception as e:
    if 'Duplicate' in str(e):
        print("activities: publish_status already exists, skipped")
    else:
        print(f"activities error: {e}")

try:
    # activities index
    cur.execute("CREATE INDEX idx_activities_publish ON activities(publish_status)")
    print("activities: index created")
except Exception as e:
    if 'Duplicate' in str(e):
        print("activities: index already exists, skipped")
    else:
        print(f"activities index error: {e}")

print("\nMigration complete!")
cur.close()
conn.close()
