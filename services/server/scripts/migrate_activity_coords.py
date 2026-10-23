"""
为 activities 表添加 latitude/longitude 列
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import execute

def migrate():
    try:
        execute("ALTER TABLE activities ADD COLUMN latitude DECIMAL(12,8) DEFAULT NULL AFTER location")
        print("+ latitude column added")
    except Exception as e:
        if 'Duplicate' in str(e):
            print("  latitude column already exists")
        else:
            print(f"! latitude: {e}")

    try:
        execute("ALTER TABLE activities ADD COLUMN longitude DECIMAL(12,8) DEFAULT NULL AFTER latitude")
        print("+ longitude column added")
    except Exception as e:
        if 'Duplicate' in str(e):
            print("  longitude column already exists")
        else:
            print(f"! longitude: {e}")

if __name__ == '__main__':
    migrate()
