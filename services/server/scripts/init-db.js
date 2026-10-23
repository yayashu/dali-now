/**
 * 数据库初始化脚本
 * 执行 MySQL DDL + 种子数据导入
 * 用法: node scripts/init-db.js
 */
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

async function init() {
  const config = require('../config').db

  // 先连接到 MySQL（不指定数据库），创建数据库
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  })



  // 读取并执行 SQL
  const sqlPath = path.join(__dirname, '..', 'sql', 'schema_mysql.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  // 按分号分割 SQL 语句执行
  const statements = sql
    .replace(/--.*$/gm, '')       // 去除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 去除多行注释
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of statements) {
    try {
      await conn.execute(stmt)
    } catch (e) {
      // 忽略 "database exists" 等错误
      if (!e.message.includes('exists') && !e.message.includes('Duplicate')) {
        // SQL 执行警告（非重复性错误）
      }
    }
  }

  await conn.end()
}

init().catch(() => {
  process.exit(1)
})
