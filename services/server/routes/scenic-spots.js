const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')

// 获取景区列表（公开，用于小程序展示和下拉搜索）
router.get('/', async (req, res) => {
  try {
    const { keyword } = req.query
    const selFields = 'id, name, cover, description, ticket_type, ticket_price, ticket_note, open_time, close_time, level, sort_order'
    let sql, params
    if (keyword) {
      const likePattern = '%' + keyword.trim().split('').join('%') + '%'
      sql = `SELECT ${selFields} FROM scenic_spots WHERE name LIKE ? AND status = ? ORDER BY sort_order ASC LIMIT 50`
      params = [likePattern, 'active']
    } else {
      sql = `SELECT ${selFields} FROM scenic_spots WHERE status = ? ORDER BY sort_order ASC LIMIT 200`
      params = ['active']
    }
    const rows = await query(sql, params)
    res.json({ code: 0, data: rows })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取单个景区详情
router.get('/:id', async (req, res) => {
  try {
    const [row] = await query('SELECT * FROM scenic_spots WHERE id = ?', [req.params.id])
    if (!row) {
      return res.json({ code: -1, msg: '景区不存在' })
    }
    res.json({ code: 0, data: row })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
