const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')

// 获取社区帖列表
router.get('/posts', async (req, res) => {
  try {
    const { orderBy, orderDir } = req.query
    const { page, size, offset } = getPagination(req)

    const sortField = orderBy || 'created_at'
    const sortDir = orderDir === 'asc' ? 'ASC' : 'DESC'

    const [{ total }] = await query('SELECT COUNT(*) as total FROM community_posts')
    const posts = await query(
      `SELECT * FROM community_posts ORDER BY ${sortField} ${sortDir} LIMIT ? OFFSET ?`,
      [size, offset]
    )

    // 附带标签
    if (posts.length > 0) {
      const postIds = posts.map(p => p.id)
      const placeholders = postIds.map(() => '?').join(',')
      const tags = await query(
        `SELECT post_id, tag FROM community_tags WHERE post_id IN (${placeholders})`,
        postIds
      )
      const tagMap = {}
      for (const t of tags) {
        if (!tagMap[t.post_id]) tagMap[t.post_id] = []
        tagMap[t.post_id].push(t.tag)
      }
      for (const post of posts) {
        post.tags = tagMap[post.id] || []
      }
    }

    res.json({ code: 0, data: paginatedData(posts, total, page, size) })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 获取单个社区帖
router.get('/posts/:id', async (req, res) => {
  try {
    const [post] = await query('SELECT * FROM community_posts WHERE id = ?', [req.params.id])
    if (!post) {
      return res.json({ code: -1, msg: '帖子不存在' })
    }
    const tags = await query('SELECT tag FROM community_tags WHERE post_id = ?', [req.params.id])
    post.tags = tags.map(t => t.tag)
    // 增加浏览量
    await query('UPDATE community_posts SET view_count = view_count + 1 WHERE id = ?', [req.params.id])
    res.json({ code: 0, data: post })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
