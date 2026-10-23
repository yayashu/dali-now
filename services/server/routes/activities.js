const router = require('express').Router()
const crypto = require('crypto')
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { auth } = require('../middleware/auth')

// 获取活动列表
router.get('/', async (req, res) => {
  try {
    const { district, type, status, date, orderBy, orderDir } = req.query
    const { page, size, offset } = getPagination(req)

    let baseSql = "SELECT * FROM activities WHERE review_status='approved' AND publish_status='listed'"
    let countSql = "SELECT COUNT(*) as total FROM activities WHERE review_status='approved' AND publish_status='listed'"
    const params = []

    if (district) {
      const cond = ' AND district_code = ?'
      baseSql += cond; countSql += cond
      params.push(district)
    }
    if (type) {
      const cond = ' AND type = ?'
      baseSql += cond; countSql += cond
      params.push(type)
    }
    if (status) {
      const cond = ' AND status = ?'
      baseSql += cond; countSql += cond
      params.push(status)
    } else {
      baseSql += " AND status = 'active'"
      countSql += " AND status = 'active'"
    }
    if (date) {
      const cond = ' AND date = ?'
      baseSql += cond; countSql += cond
      params.push(date)
    }

    const sortField = orderBy || 'hot_value'
    const sortDir = orderDir === 'asc' ? 'ASC' : 'DESC'

    const total = (await query(countSql, [...params]))[0].total
    baseSql += ` ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`
    params.push(size, offset)
    const rows = await query(baseSql, params)

    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取单个活动详情
router.get('/:id', async (req, res) => {
  try {
    const [activity] = await query('SELECT * FROM activities WHERE id = ?', [req.params.id])
    if (!activity) {
      return res.json({ code: -1, msg: '活动不存在' })
    }
    // 附带标签
    const tags = await query('SELECT tag FROM activity_tags WHERE activity_id = ?', [req.params.id])
    activity.tags = tags.map(t => t.tag)
    // 附带图片
    const images = await query('SELECT image_url FROM activity_images WHERE activity_id = ? ORDER BY sort_order ASC', [req.params.id])
    activity.images = images.map(i => i.image_url)

    res.json({ code: 0, data: activity })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 模糊搜索活动
router.get('/search/:keyword', async (req, res) => {
  try {
    const keyword = `%${req.params.keyword}%`
    const { page, size, offset } = getPagination(req)

    const [{ total }] = await query(
      "SELECT COUNT(*) as total FROM activities WHERE name LIKE ? AND status = 'active' AND review_status='approved' AND publish_status='listed'",
      [keyword]
    )
    const rows = await query(
      "SELECT * FROM activities WHERE name LIKE ? AND status = 'active' AND review_status='approved' AND publish_status='listed' ORDER BY hot_value DESC LIMIT ? OFFSET ?",
      [keyword, size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 用户提交新活动
router.post('/submit', auth, async (req, res) => {
  try {
    const aid = 'act_' + crypto.randomBytes(4).toString('hex')
    const fields = ['id','name','type','type_name','cover','date','time','time_range',
                    'location','latitude','longitude','district_code','price','price_text',
                    'is_free','description','organizer','traffic','notes','status','review_status']
    const vals = [aid]
    for (let i = 1; i < fields.length; i++) {
      vals.push(req.body[fields[i]] || '')
    }
    await query(
      `INSERT INTO activities (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
      vals
    )
    res.json({ code: 0, data: { id: aid }, msg: '提交成功，等待管理员审核' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
