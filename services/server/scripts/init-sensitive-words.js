/**
 * 初始化敏感词库表
 * 用法: node server/scripts/init-sensitive-words.js
 */
const mysql = require('mysql2/promise')
const config = require('../config')

const DB = {
  host: process.env.DB_HOST || config.db.host,
  port: parseInt(process.env.DB_PORT) || config.db.port,
  user: process.env.DB_USER || config.db.user,
  password: process.env.DB_PASSWORD || config.db.password,
  database: process.env.DB_NAME || config.db.database,
  charset: 'utf8mb4'
}

async function init() {
  const conn = await mysql.createConnection(DB)

  // 创建表
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sensitive_words (
      id INT AUTO_INCREMENT PRIMARY KEY,
      word VARCHAR(100) NOT NULL UNIQUE,
      enabled TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 写入测试词（IGNORE 避免重复插入）
  await conn.execute(
    'INSERT IGNORE INTO sensitive_words (word) VALUES (?), (?)',
    ['测试敏感词A', '测试敏感词B']
  )

  // 验证
  const [rows] = await conn.execute('SELECT * FROM sensitive_words')
  await conn.end()
}

init().catch(e => {
  process.exit(1)
})
