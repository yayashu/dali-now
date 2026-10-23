/**
 * MySQL 连接池管理
 */
const mysql = require('mysql2/promise')
const config = require('./config')

let pool = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db)
  }
  return pool
}

/**
 * 执行 SQL 查询
 * @param {string} sql    SQL 语句
 * @param {Array}  params 参数
 */
async function query(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [rows] = await conn.query(sql, params)
    return rows
  } finally {
    conn.release()
  }
}

/**
 * 执行多条 SQL（事务）
 */
async function transaction(callback) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const result = await callback(conn)
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

module.exports = { query, transaction, getPool }
