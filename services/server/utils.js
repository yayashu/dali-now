/**
 * 分页工具
 * ============================================================
 * 统一处理分页参数，兼容 page/size（推荐）与 limit/offset（兼容旧版）
 * 所有数据查询列表接口统一返回 { list, total, page, size }
 */

/**
 * 从请求 query 提取分页参数
 * @param {object} req - Express request 对象
 * @returns {{ page: number, size: number, offset: number }}
 */
function getPagination(req) {
  const config = require('./config')
  const { defaultPage, defaultSize, maxSize } = config.pagination
  const query = req.query || {}

  // 优先 page/size
  let page = parseInt(query.page) || defaultPage
  let size = parseInt(query.size) || defaultSize

  // 兼容旧版 limit/offset（仅当未显式传 page 时）
  if (!query.page && (query.limit || query.offset)) {
    const limit = parseInt(query.limit) || defaultSize
    const offset = parseInt(query.offset) || 0
    size = limit
    page = limit > 0 ? Math.floor(offset / limit) + 1 : 1
  }

  // 安全范围
  if (page < 1) page = defaultPage
  if (size < 1) size = defaultSize
  if (size > maxSize) size = maxSize

  return { page, size, offset: (page - 1) * size }
}

/**
 * 包装分页响应的 data
 * @param {Array}  list  当前页数据
 * @param {number} total 总记录数
 * @param {number} page  当前页码
 * @param {number} size  每页条数
 * @returns {{ list, total, page, size }}
 */
function paginatedData(list, total, page, size) {
  return { list, total, page, size }
}

module.exports = { getPagination, paginatedData }
