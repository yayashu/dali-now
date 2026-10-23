const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { createSensitiveFilter } = require('../middleware/sensitive-filter')

const searchFilter = createSensitiveFilter(['keyword'])

// 添加搜索历史（含敏感词过滤）
router.post('/history', searchFilter, async (req, res) => {
  try {
    const { user_id, keyword } = req.body
    if (!keyword || !keyword.trim()) {
      return res.json({ code: 0, msg: '关键词为空' })
    }
    // 去重
    await query('DELETE FROM search_history WHERE user_id = ? AND keyword = ?', [user_id, keyword])
    await query('INSERT INTO search_history (user_id, keyword) VALUES (?, ?)', [user_id, keyword.trim()])
    res.json({ code: 0, msg: '已记录' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取搜索历史
router.get('/history/:user_id', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const [{ total }] = await query(
      'SELECT COUNT(*) as total FROM search_history WHERE user_id = ?',
      [req.params.user_id]
    )
    const rows = await query(
      'SELECT keyword, created_at FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.params.user_id, size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 清空搜索历史
router.delete('/history/:user_id', async (req, res) => {
  try {
    await query('DELETE FROM search_history WHERE user_id = ?', [req.params.user_id])
    res.json({ code: 0, msg: '已清空' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 全局搜索活动
router.get('/activities', async (req, res) => {
  try {
    const { keyword } = req.query
    if (!keyword) {
      return res.json({ code: 0, data: paginatedData([], 0, 1, 20) })
    }
    const kw = `%${keyword}%`
    const { page, size, offset } = getPagination(req)

    const [{ total }] = await query(
      "SELECT COUNT(*) as total FROM activities WHERE name LIKE ? AND status = 'active'",
      [kw]
    )
    const rows = await query(
      "SELECT * FROM activities WHERE name LIKE ? AND status = 'active' ORDER BY hot_value DESC LIMIT ? OFFSET ?",
      [kw, size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
