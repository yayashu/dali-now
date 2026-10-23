const router = require('express').Router()
const crypto = require('crypto')
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { createSensitiveFilter } = require('../middleware/sensitive-filter')
const { auth } = require('../middleware/auth')

const checkinFilter = createSensitiveFilter(['note'])

// 获取打卡点列表
router.get('/points', async (req, res) => {
  try {
    const { type, activity_id, keyword, latitude, longitude } = req.query
    const lat = parseFloat(latitude)
    const lng = parseFloat(longitude)
    const { page, size, offset } = getPagination(req)

    let baseSql = "SELECT * FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
    let countSql = "SELECT COUNT(*) as total FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
    const params = []

    if (type) {
      const cond = ' AND type = ?'
      baseSql += cond; countSql += cond
      params.push(type)
    }
    if (activity_id) {
      const cond = ' AND activity_id = ?'
      baseSql += cond; countSql += cond
      params.push(activity_id)
    }

    // 关键字分词模糊检索：全词 + 首尾 bigram
    let keywordApplied = false
    if (keyword) {
      const kw = keyword.trim()
      const patterns = new Set()
      patterns.add('%' + kw + '%')                     // 全词匹配
      if (kw.length >= 2) patterns.add('%' + kw.substring(0, 2) + '%')   // 首 bigram
      if (kw.length >= 4) patterns.add('%' + kw.substring(kw.length - 2) + '%') // 尾 bigram
      const patternList = [...patterns]
      const likeClauses = patternList.map(() => '(name LIKE ? OR description LIKE ? OR landmark LIKE ?)').join(' OR ')
      const cond = ' AND (' + likeClauses + ')'
      baseSql += cond; countSql += cond
      for (const p of patternList) {
        params.push(p, p, p)
      }
      keywordApplied = true
    }

    let total = (await query(countSql, [...params]))[0].total

    // 关键字无结果时：移除关键字条件，按距离回退
    if (keywordApplied && total === 0 && !isNaN(lat) && !isNaN(lng)) {
      baseSql = "SELECT * FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
      countSql = "SELECT COUNT(*) as total FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
      params.length = 0
      if (type) {
        const cond = ' AND type = ?'
        baseSql += cond; countSql += cond
        params.push(type)
      }
      if (activity_id) {
        const cond = ' AND activity_id = ?'
        baseSql += cond; countSql += cond
        params.push(activity_id)
      }
      total = (await query(countSql, [...params]))[0].total
      // 按欧氏距离由近及远排序
      baseSql += ' ORDER BY (latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) ASC LIMIT ? OFFSET ?'
      params.push(lat, lat, lng, lng, size, offset)
      const rows = await query(baseSql, params)
      return res.json({ code: 0, data: { ...paginatedData(rows, total, page, size), fallback: true } })
    }

    baseSql += keywordApplied
      ? ' ORDER BY (CASE WHEN name LIKE ? THEN 4 WHEN name LIKE ? THEN 3 WHEN description LIKE ? THEN 2 WHEN landmark LIKE ? THEN 1 ELSE 0 END) DESC, popularity DESC LIMIT ? OFFSET ?'
      : ' ORDER BY popularity DESC LIMIT ? OFFSET ?'
    if (keywordApplied) {
      const kw = keyword.trim()
      params.push(kw + '%', '%' + kw + '%', '%' + kw + '%', '%' + kw + '%', size, offset)
    } else {
      params.push(size, offset)
    }
    const rows = await query(baseSql, params)

    // 附带景区名称
    const scenicSpotIds = [...new Set(rows.filter(r => r.scenic_spot_id).map(r => r.scenic_spot_id))]
    if (scenicSpotIds.length > 0) {
      const spotRows = await query(
        `SELECT id, name FROM scenic_spots WHERE id IN (${scenicSpotIds.map(() => '?').join(',')})`,
        scenicSpotIds
      )
      const spotMap = {}
      spotRows.forEach(s => { spotMap[s.id] = s.name })
      rows.forEach(r => {
        r.scenic_spot_name = spotMap[r.scenic_spot_id] || ''
      })
    } else {
      rows.forEach(r => { r.scenic_spot_name = '' })
    }

    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取单个打卡点详情
router.get('/points/:id', async (req, res) => {
  try {
    const [row] = await query('SELECT * FROM checkin_points WHERE id = ?', [req.params.id])
    if (!row) {
      return res.json({ code: -1, msg: '打卡点不存在' })
    }
    // 附带照片
    const photos = await query(
      'SELECT * FROM checkin_photos WHERE checkin_id = ? ORDER BY created_at DESC',
      [req.params.id]
    )
    row.photos = photos
    // 附带景区名称
    if (row.scenic_spot_id) {
      const [spot] = await query('SELECT name FROM scenic_spots WHERE id = ?', [row.scenic_spot_id])
      row.scenic_spot_name = spot ? spot.name : ''
    } else {
      row.scenic_spot_name = ''
    }
    res.json({ code: 0, data: row })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 用户提交新打卡点
router.post('/points/submit', auth, async (req, res) => {
  try {
    const cid = 'cp_' + crypto.randomBytes(4).toString('hex')
    const fields = ['id','name','type','scenic_spot_id','cover','latitude','longitude','description',
                    'angle','composition','best_time','crowd_level','crowd_peak',
                    'tips','taboos','landmark','popularity','charge_type','charge_price',
                    'charge_note','review_status']
    const intFields = new Set(['scenic_spot_id', 'popularity'])
    const vals = [cid]
    for (let i = 1; i < fields.length; i++) {
      const v = req.body[fields[i]]
      if (intFields.has(fields[i]) && (v === undefined || v === null || v === '')) {
        vals.push(null)
      } else {
        vals.push(v || '')
      }
    }
    await query(
      `INSERT INTO checkin_points (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
      vals
    )
    res.json({ code: 0, data: { id: cid }, msg: '提交成功，等待管理员审核' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 用户打卡（含敏感词过滤）
router.post('/checkin', checkinFilter, async (req, res) => {
  try {
    const { user_id, checkin_id, image_url, note, latitude, longitude } = req.body
    await query(
      'INSERT INTO user_checkins (user_id, checkin_id, image_url, note, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, checkin_id, image_url, note, latitude, longitude]
    )
    res.json({ code: 0, msg: '打卡成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
