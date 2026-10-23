const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')

// 获取所有区域
router.get('/', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const [{ total }] = await query('SELECT COUNT(*) as total FROM districts')
    const rows = await query('SELECT * FROM districts ORDER BY sort_order ASC LIMIT ? OFFSET ?', [size, offset])
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
