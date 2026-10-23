/**
 * API 认证中间件
 * ============================================================
 * 验证 Authorization: Bearer <token> 请求头
 * 查找用户并注入 req.currentUser
 * 
 * 用法:
 *   const { auth } = require('../middleware/auth')
 *   router.post('/submit', auth, handler)
 * 
 * 无认证时有三种模式:
 *   auth          - 必须登录，否则 401
 *   auth.optional - 可选登录，成功则注入 currentUser，未登录不报错
 */

const { query } = require('../db')

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    
    if (!match) {
      return res.status(401).json({ code: -1, msg: '请先登录' })
    }

    const token = match[1]
    const [user] = await query('SELECT * FROM users WHERE token = ?', [token])
    
    if (!user) {
      return res.status(401).json({ code: -1, msg: '登录已过期，请重新登录' })
    }

    // 检查封禁状态
    if (user.status === 'disabled') {
      return res.status(403).json({ code: -1, msg: '账号已被禁用' })
    }
    if (user.status === 'muted' && user.ban_until) {
      const now = new Date()
      const until = new Date(user.ban_until)
      if (now > until) {
        // 到期自动恢复
        await query('UPDATE users SET status=?, ban_until=NULL, ban_reason=NULL WHERE id=?', ['active', user.id])
        user.status = 'active'
        user.ban_until = null
        user.ban_reason = null
      }
    }

    req.currentUser = user
    next()
  } catch (e) {
    res.status(500).json({ code: -1, msg: '认证服务异常' })
  }
}

// 可选认证：成功则注入 currentUser，未登录不报错
authMiddleware.optional = async function(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || ''
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    
    if (match) {
      const [user] = await query('SELECT * FROM users WHERE token = ?', [match[1]])
      if (user) {
        req.currentUser = user
      }
    }
    next()
  } catch (e) {
    next()
  }
}

module.exports = { auth: authMiddleware }
