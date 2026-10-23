
# -*- coding: utf-8 -*-
"""
大理此刻 - MySQL 数据库初始化脚本
连接远程 MySQL 并执行 DDL，创建所有表结构和种子数据
"""
import pymysql
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_CONFIG

DB_NAME = DB_CONFIG.get('database', 'dali_now')
SQL_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sql', 'schema_mysql.sql')

def main():
    try:
        conn = pymysql.connect(**DB_CONFIG)
    except Exception as e:
        sys.exit(1)

    cursor = conn.cursor()

    try:
        cursor.execute("CREATE DATABASE IF NOT EXISTS `{}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci".format(DB_NAME))
    except Exception as e:
        cursor.close()
        conn.close()
        sys.exit(1)

    cursor.execute("USE `{}`".format(DB_NAME))

    try:
        sql_path = SQL_FILE
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        statements = []
        for stmt in sql_content.split(';'):
            stmt = stmt.strip()
            if not stmt:
                continue
            upper_stmt = stmt.upper()
            if upper_stmt.startswith('CREATE DATABASE') or upper_stmt.startswith('USE '):
                continue
            lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
            clean_stmt = '\n'.join(lines).strip()
            if clean_stmt:
                statements.append(clean_stmt)

        for stmt in statements:
            try:
                cursor.execute(stmt)
            except Exception:
                pass

        conn.commit()

    except FileNotFoundError:
        cursor.close()
        conn.close()
        sys.exit(1)
    except Exception:
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

    try:
        conn = pymysql.connect(**DB_CONFIG, database=DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
    except Exception:
        pass

if __name__ == '__main__':
    main()
