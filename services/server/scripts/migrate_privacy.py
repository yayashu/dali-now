"""users 表新增 privacy_agreed 字段"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import query, execute

try:
    execute("ALTER TABLE users ADD COLUMN privacy_agreed TINYINT DEFAULT 0 AFTER is_logged_in")
    print("[OK] privacy_agreed TINYINT DEFAULT 0 added to users")
except Exception as e:
    if 'Duplicate column' in str(e):
        print("[SKIP] privacy_agreed already exists")
    else:
        print(f"[ERROR] {e}")
        raise

try:
    execute("ALTER TABLE users ADD COLUMN privacy_agreed_at DATETIME AFTER privacy_agreed")
    print("[OK] privacy_agreed_at DATETIME added to users")
except Exception as e:
    if 'Duplicate column' in str(e):
        print("[SKIP] privacy_agreed_at already exists")
    else:
        print(f"[ERROR] {e}")

print("[DONE] Migration complete")
