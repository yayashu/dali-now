import os
import pymysql

# 数据库连接信息从环境变量读取，请勿硬编码
conn = pymysql.connect(
    host=os.environ.get('DB_HOST', '127.0.0.1'),
    port=int(os.environ.get('DB_PORT', 3306)),
    user=os.environ.get('DB_USER', 'root'),
    password=os.environ.get('DB_PASSWORD', ''),
    database=os.environ.get('DB_NAME', 'dali_now'),
    charset='utf8mb4',
    autocommit=True)
cur = conn.cursor()

# Add review_status to checkin_points
try:
    cur.execute("ALTER TABLE checkin_points ADD COLUMN review_status VARCHAR(20) DEFAULT 'approved' AFTER distance")
    print('checkin_points: added review_status column')
except Exception as e:
    print(f'checkin_points: {e}')

# Add review_status to activities  
try:
    cur.execute("ALTER TABLE activities ADD COLUMN review_status VARCHAR(20) DEFAULT 'approved' AFTER duration_days")
    print('activities: added review_status column')
except Exception as e:
    print(f'activities: {e}')

# Add indexes
try:
    cur.execute("CREATE INDEX idx_checkin_points_review ON checkin_points(review_status)")
    print('checkin_points: index created')
except Exception as e:
    print(f'checkin_points index: {e}')

try:
    cur.execute("CREATE INDEX idx_activities_review ON activities(review_status)")
    print('activities: index created')
except Exception as e:
    print(f'activities index: {e}')

cur.close()
conn.close()
print('Migration complete!')
