const router = require('express').Router()
const crypto = require('crypto')
const https = require('https')
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { createSensitiveFilter } = require('../middleware/sensitive-filter')
const { auth } = require('../middleware/auth')
const config = require('../config')

const userUpdateFilter = createSensitiveFilter(['nickname'])
const bookingFilter = createSensitiveFilter(['name'])

// 微信 code2session
function code2Session(code) {
  return new Promise((resolve, reject) => {
    const { appId, secret } = config.wechat
    if (!appId || !secret) {
      return reject(new Error('微信小程序 AppID/Secret 未配置'))
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
    https.get(url, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.errcode) {
            reject(new Error(`微信API错误: ${json.errcode} ${json.errmsg}`))
          } else {
            resolve(json)
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

// 生成 token
function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

// 检查用户禁闭状态，返回 { banned: bool, msg: string }
async function checkBanned(userId) {
  const [user] = await query('SELECT status, ban_until, ban_reason FROM users WHERE id = ?', [userId])
  if (!user) return { banned: false }
  if (user.status === 'muted') {
    // 检查禁闭是否过期
    if (user.ban_until) {
      const now = new Date()
      const until = new Date(user.ban_until)
      if (now > until) {
        // 到期自动恢复
        await query('UPDATE users SET status=?, ban_until=NULL, ban_reason=NULL WHERE id=?', ['active', userId])
        return { banned: false }
      }
    }
    let msg = user.ban_reason || '您的账号已被禁闭'
    if (user.ban_until) msg += `，预计 ${new Date(user.ban_until).toLocaleString('zh-CN').slice(0, 16)} 解除`
    return { banned: true, msg }
  }
  return { banned: false }
}

// 获取/创建用户（微信授权登录）
router.post('/login', async (req, res) => {
  try {
    const { code, nickname, avatar, openid: directOpenid, privacy_agreed } = req.body

    let openid = directOpenid || ''

    // 如果有 code，通过微信 code2session 换取真实 openid
    if (code) {
      try {
        const session = await code2Session(code)
        openid = session.openid
        // session_key 可用于后续解密敏感数据，此处暂存
      } catch (wxErr) {
        // code2session 失败时，如果提供了 directOpenid 则降级使用
        if (!openid) {
          return res.json({ code: -1, msg: `微信登录失败: ${wxErr.message}` })
        }
      }
    }

    if (!openid) {
      return res.json({ code: -1, msg: '缺少 openid 或 code' })
    }

    let [user] = await query('SELECT * FROM users WHERE openid = ?', [openid])

    const token = generateToken()

    const agreed = privacy_agreed ? 1 : 0
    const agreedAt = privacy_agreed ? new Date() : null

    let is_new_user = false

    if (!user) {
      const result = await query(
        'INSERT INTO users (openid, nickname, avatar, token, is_logged_in, privacy_agreed, privacy_agreed_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [openid, nickname || '旅行者·大理', avatar || '', token, agreed, agreedAt]
      )
      user = { id: result.insertId, openid, nickname: nickname || '旅行者·大理', avatar: avatar || '', is_logged_in: 1, privacy_agreed: agreed }
      is_new_user = true
    } else {
      // 检查封禁状态
      const userStatus = user.status || 'active'
      if (userStatus === 'disabled') {
        return res.json({ code: -1, msg: `您的账号已被禁用，无法登录。原因: ${user.ban_reason || '违反用户协议'}` })
      }
      if (userStatus === 'muted') {
        if (user.ban_until) {
          const now = new Date()
          const until = new Date(user.ban_until)
          if (now > until) {
            // 禁闭已过期，自动恢复
            await query('UPDATE users SET status=?, ban_until=NULL, ban_reason=NULL WHERE id=?', ['active', user.id])
            user.status = 'active'
            user.ban_until = null
            user.ban_reason = null
          }
        }
      }
      // 已有用户登录：只更新 token 和登录状态，不覆盖用户已修改的头像/昵称
      const updateFields = ['is_logged_in = 1', 'token = ?']
      const updateValues = [token]
      // 如果用户之前未同意且本次同意，更新
      if (privacy_agreed && !user.privacy_agreed) {
        updateFields.push('privacy_agreed = 1', 'privacy_agreed_at = ?')
        updateValues.push(new Date())
      }
      updateValues.push(user.id)
      await query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateValues)
      user.is_logged_in = 1
      user.privacy_agreed = privacy_agreed ? 1 : user.privacy_agreed || 0
    }

    res.json({ code: 0, data: { token, user, is_new_user } })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 更新用户信息（含敏感词过滤）
router.put('/:id', auth, userUpdateFilter, async (req, res) => {
  try {
    const banCheck = await checkBanned(req.params.id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    const { nickname, avatar, phone } = req.body
    await query(
      'UPDATE users SET nickname = ?, avatar = ?, phone = ? WHERE id = ?',
      [nickname, avatar, phone, req.params.id]
    )
    res.json({ code: 0, msg: '更新成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取用户信息
router.get('/:id', async (req, res) => {
  try {
    const [user] = await query('SELECT * FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.json({ code: -1, msg: '用户不存在' })
    }
    res.json({ code: 0, data: user })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 查询用户封禁状态（轻量接口，供小程序启动时校验）
router.get('/:id/status', async (req, res) => {
  try {
    const [user] = await query('SELECT status, ban_until, ban_reason FROM users WHERE id = ?', [req.params.id])
    if (!user) {
      return res.json({ code: -1, msg: '用户不存在' })
    }
    // 检查禁闭是否过期，自动恢复
    if (user.status === 'muted' && user.ban_until) {
      const now = new Date()
      const until = new Date(user.ban_until)
      if (now > until) {
        await query('UPDATE users SET status=?, ban_until=NULL, ban_reason=NULL WHERE id=?', ['active', req.params.id])
        user.status = 'active'
        user.ban_until = null
        user.ban_reason = null
      }
    }
    res.json({ code: 0, data: user })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取用户统计
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.params.id
    const [[{ bookingCount }]] = await query('SELECT COUNT(*) as bookingCount FROM user_bookings WHERE user_id = ?', [userId])
    const [[{ checkinCount }]] = await query('SELECT COUNT(*) as checkinCount FROM user_checkins WHERE user_id = ?', [userId])
    const [[{ favCount }]] = await query('SELECT COUNT(*) as favCount FROM user_favorites WHERE user_id = ?', [userId])
    const [[{ postCount }]] = await query('SELECT COUNT(*) as postCount FROM live_posts WHERE user_id = ?', [userId])

    res.json({ code: 0, data: { bookingCount, checkinCount, favCount, postCount } })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 用户活动预约
router.get('/:id/bookings', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const [{ total }] = await query(
      'SELECT COUNT(*) as total FROM user_bookings WHERE user_id = ?',
      [req.params.id]
    )
    const rows = await query(
      `SELECT ub.*, a.name as activity_name, a.cover as activity_cover, a.date as activity_date
       FROM user_bookings ub
       LEFT JOIN activities a ON ub.activity_id = a.id
       WHERE ub.user_id = ?
       ORDER BY ub.created_at DESC LIMIT ? OFFSET ?`,
      [req.params.id, size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 创建预约（含敏感词过滤）
router.post('/:id/bookings', auth, bookingFilter, async (req, res) => {
  try {
    const banCheck = await checkBanned(req.params.id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    const { activity_id, name, phone, count } = req.body
    await query(
      'INSERT INTO user_bookings (user_id, activity_id, name, phone, count) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, activity_id, name, phone, count || 1]
    )
    // 更新活动已预约数
    await query('UPDATE activities SET booked = booked + ? WHERE id = ?', [count || 1, activity_id])
    res.json({ code: 0, msg: '预约成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 收藏
router.post('/:id/favorites', auth, async (req, res) => {
  try {
    const banCheck = await checkBanned(req.params.id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    const { item_type, item_id } = req.body
    await query(
      'INSERT IGNORE INTO user_favorites (user_id, item_type, item_id) VALUES (?, ?, ?)',
      [req.params.id, item_type, item_id]
    )
    res.json({ code: 0, msg: '收藏成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 取消收藏
router.delete('/:id/favorites', auth, async (req, res) => {
  try {
    const { item_type, item_id } = req.body
    await query(
      'DELETE FROM user_favorites WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [req.params.id, item_type, item_id]
    )
    res.json({ code: 0, msg: '已取消收藏' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取收藏列表
router.get('/:id/favorites', async (req, res) => {
  try {
    const { item_type } = req.query
    const { page, size, offset } = getPagination(req)

    let baseSql = 'SELECT * FROM user_favorites WHERE user_id = ?'
    let countSql = 'SELECT COUNT(*) as total FROM user_favorites WHERE user_id = ?'
    const params = [req.params.id]

    if (item_type) {
      const cond = ' AND item_type = ?'
      baseSql += cond; countSql += cond
      params.push(item_type)
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


// 获取用户打卡列表
router.get('/:id/checkins', async (req, res) => {
  try {
    const { page, size, offset } = getPagination(req)
    const total = (await query(
      'SELECT COUNT(*) as total FROM user_checkins WHERE user_id = ?',
      [req.params.id]
    ))[0].total
    const rows = await query(
      'SELECT uc.*, cp.name as point_name, cp.cover as point_cover ' +
      'FROM user_checkins uc ' +
      'LEFT JOIN checkin_points cp ON uc.checkin_id = cp.id ' +
      'WHERE uc.user_id = ? ' +
      'ORDER BY uc.created_at DESC LIMIT ? OFFSET ?',
      [req.params.id, size, offset]
    )
    res.json({ code: 0, data: paginatedData(rows, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 用户打卡
router.post('/:id/checkins', auth, async (req, res) => {
  try {
    const banCheck = await checkBanned(req.params.id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    const { point_id, image_url, note, latitude, longitude } = req.body
    await query(
      'INSERT INTO user_checkins (user_id, checkin_id, image_url, note, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, point_id, image_url || '', note || '', latitude || 0, longitude || 0]
    )
    res.json({ code: 0, msg: '打卡成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 点赞
router.post('/:id/likes', auth, async (req, res) => {
  try {
    const banCheck = await checkBanned(req.params.id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    const { item_type, item_id } = req.body
    await query(
      'INSERT IGNORE INTO user_likes (user_id, item_type, item_id) VALUES (?, ?, ?)',
      [req.params.id, item_type, item_id]
    )
    res.json({ code: 0, msg: '点赞成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 取消点赞
router.delete('/:id/likes', auth, async (req, res) => {
  try {
    const { item_type, item_id } = req.body
    await query(
      'DELETE FROM user_likes WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [req.params.id, item_type, item_id]
    )
    res.json({ code: 0, msg: '已取消点赞' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
