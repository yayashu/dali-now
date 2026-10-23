const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')

// 获取本地生活分类
router.get('/categories', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const [{ total }] = await query('SELECT COUNT(*) as total FROM local_life_categories')
    const rows = await query('SELECT * FROM local_life_categories ORDER BY id ASC LIMIT ? OFFSET ?', [size, offset])
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取本地生活项目列表
router.get('/items', async (req, res) => {
  try {
    const { category } = req.query
    const { page, size, offset } = getPagination(req)

    let baseSql = 'SELECT * FROM local_life_items WHERE 1=1'
    let countSql = 'SELECT COUNT(*) as total FROM local_life_items WHERE 1=1'
    const params = []

    if (category) {
      const cond = ' AND category = ?'
      baseSql += cond; countSql += cond
      params.push(category)
    }

    const total = (await query(countSql, [...params]))[0].total
    baseSql += ' ORDER BY sort_order ASC LIMIT ? OFFSET ?'
    params.push(size, offset)
    const rows = await query(baseSql, params)

    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
