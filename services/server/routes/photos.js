const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')

// 获取打卡照片列表
router.get('/checkin', async (req, res) => {
  try {
    const { checkin_id } = req.query
    const { page, size, offset } = getPagination(req)

    let baseSql = 'SELECT * FROM checkin_photos WHERE 1=1'
    let countSql = 'SELECT COUNT(*) as total FROM checkin_photos WHERE 1=1'
    const params = []

    if (checkin_id) {
      const cond = ' AND checkin_id = ?'
      baseSql += cond; countSql += cond
      params.push(checkin_id)
    }

    const total = (await query(countSql, [...params]))[0].total
    baseSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(size, offset)
    const rows = await query(baseSql, params)

    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取首页照片墙
router.get('/homepage', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const [{ total }] = await query('SELECT COUNT(*) as total FROM homepage_photos')
    const rows = await query(
      'SELECT * FROM homepage_photos ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?',
      [size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
