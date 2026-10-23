const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { createSensitiveFilter } = require('../middleware/sensitive-filter')
const { auth } = require('../middleware/auth')

const liveFilter = createSensitiveFilter(['content', 'user_name', 'location'])

// 禁闭检查
async function checkBanned(userId) {
  if (!userId) return { banned: false }
  const [user] = await query('SELECT status, ban_until, ban_reason FROM users WHERE id = ?', [userId])
  if (!user) return { banned: false }
  if (user.status === 'muted') {
    if (user.ban_until && new Date() > new Date(user.ban_until)) {
      await query('UPDATE users SET status=?, ban_until=NULL, ban_reason=NULL WHERE id=?', ['active', userId])
      return { banned: false }
    }
    let msg = user.ban_reason || '您的账号已被禁闭'
    if (user.ban_until) msg += `，预计 ${new Date(user.ban_until).toLocaleString('zh-CN').slice(0, 16)} 解除`
    return { banned: true, msg }
  }
  return { banned: false }
}

// 获取现场发文列表
router.get('/posts', async (req, res) => {
  try {
    const { activity_id, user_id, orderBy, orderDir } = req.query
    const { page, size, offset } = getPagination(req)

    let baseSql = 'SELECT * FROM live_posts WHERE 1=1'
    let countSql = 'SELECT COUNT(*) as total FROM live_posts WHERE 1=1'
    const params = []

    if (activity_id) {
      const cond = ' AND activity_id = ?'
      baseSql += cond; countSql += cond
      params.push(activity_id)
    }
    if (user_id) {
      const cond = ' AND user_id = ?'
      baseSql += cond; countSql += cond
      params.push(user_id)
    }

    const sortField = orderBy || 'post_time'
    const sortDir = orderDir === 'asc' ? 'ASC' : 'DESC'

    const total = (await query(countSql, [...params]))[0].total
    baseSql += ` ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`
    params.push(size, offset)
    const posts = await query(baseSql, params)

    // 附带图片
    if (posts.length > 0) {
      const postIds = posts.map(p => p.id)
      const placeholders = postIds.map(() => '?').join(',')
      const images = await query(
        `SELECT post_id, image_url FROM live_post_images WHERE post_id IN (${placeholders}) ORDER BY sort_order ASC`,
        postIds
      )
      const imageMap = {}
      for (const img of images) {
        if (!imageMap[img.post_id]) imageMap[img.post_id] = []
        imageMap[img.post_id].push(img.image_url)
      }
      for (const post of posts) {
        post.images = imageMap[post.id] || []
      }
    }

    res.json({ code: 0, data: paginatedData(posts, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取单个现场发文
router.get('/posts/:id', async (req, res) => {
  try {
    const [post] = await query('SELECT * FROM live_posts WHERE id = ?', [req.params.id])
    if (!post) {
      return res.json({ code: -1, msg: '发文不存在' })
    }
    const images = await query(
      'SELECT image_url FROM live_post_images WHERE post_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    )
    post.images = images.map(i => i.image_url)
    res.json({ code: 0, data: post })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 发布现场动态（含敏感词过滤）
router.post('/posts', auth, liveFilter, async (req, res) => {
  try {
    const { id, user_id, activity_id, activity_name, user_name, user_avatar, type, content, cover, video_url, point_id, point_name, location, post_time, post_date, is_verified, images } = req.body
    // 禁闭检查
    const banCheck = await checkBanned(user_id)
    if (banCheck.banned) return res.json({ code: -1, msg: banCheck.msg })
    await query(
      `INSERT INTO live_posts (id, user_id, activity_id, activity_name, user_name, user_avatar, type, content, cover, video_url, point_id, point_name, location, post_time, post_date, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id || '', activity_id, activity_name, user_name, user_avatar, type, content, cover, video_url, point_id || '', point_name || '', location, post_time, post_date, is_verified || 1]
    )
    // 保存图片
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await query(
          'INSERT INTO live_post_images (post_id, image_url, sort_order) VALUES (?, ?, ?)',
          [id, images[i], i]
        )
      }
    }
    res.json({ code: 0, msg: '发布成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 隐藏/取消隐藏现场发文
router.put('/posts/:id/hide', async (req, res) => {
  try {
    const { is_hidden } = req.body
    await query('UPDATE live_posts SET is_hidden = ? WHERE id = ?', [is_hidden ? 1 : 0, req.params.id])
    res.json({ code: 0, msg: is_hidden ? '已隐藏' : '已恢复显示' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 删除现场发文
router.delete('/posts/:id', async (req, res) => {
  try {
    await query('DELETE FROM live_post_images WHERE post_id = ?', [req.params.id])
    await query('DELETE FROM live_posts WHERE id = ?', [req.params.id])
    res.json({ code: 0, msg: '已删除' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 点赞现场发文
router.post('/posts/:id/like', async (req, res) => {
  try {
    await query('UPDATE live_posts SET like_count = like_count + 1 WHERE id = ?', [req.params.id])
    res.json({ code: 0, msg: '点赞成功' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
