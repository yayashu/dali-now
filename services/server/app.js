/**
 * 大理此刻 - 后端 API 服务主入口
 * ============================================================
 * 为微信小程序提供 MySQL 数据存取接口
 * 端口: 3000
 */
const express = require('express')
const path = require('path')
const os = require('os')
const config = require('./config')
const { query } = require('./db')
const { signatureAuth } = require('./middleware/signature')
const app = express()

// 信任 Nginx 反代 IP（X-Real-IP / X-Forwarded-For）
app.set('trust proxy', 1)

// ============================================================
// 频率限制（零依赖，兼容 Node.js 10+）
// ============================================================
const rateLimitStore = {}  // { ip: [{timestamp}, ...] }
const RATE_LIMIT_CLEAN_INTERVAL = 5 * 60 * 1000  // 每 5 分钟清理一次过期记录

function getClientIP(req) {
  return req.headers['x-real-ip'] ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.ip || req.connection.remoteAddress || '127.0.0.1'
}

function createRateLimiter(maxReq, windowMs, msg) {
  return function (req, res, next) {
    const ip = getClientIP(req)
    const now = Date.now()
    const cutoff = now - windowMs

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = []
    }
    const tsList = rateLimitStore[ip]
    // 清理窗口外的旧记录
    while (tsList.length > 0 && tsList[0] < cutoff) {
      tsList.shift()
    }
    if (tsList.length >= maxReq) {
      return res.status(429).json({ code: -1, msg: msg })
    }
    tsList.push(now)
    next()
  }
}

// 定期清理过期 IP 条目，防止内存泄漏
setInterval(function () {
  const cutoff = Date.now() - 5 * 60 * 1000
  for (var ip in rateLimitStore) {
    if (rateLimitStore.hasOwnProperty(ip)) {
      while (rateLimitStore[ip].length > 0 && rateLimitStore[ip][0] < cutoff) {
        rateLimitStore[ip].shift()
      }
      if (rateLimitStore[ip].length === 0) {
        delete rateLimitStore[ip]
      }
    }
  }
}, RATE_LIMIT_CLEAN_INTERVAL)

// 全局限频: 100 req/min per IP
const generalLimiter = createRateLimiter(100, 60 * 1000, '请求过于频繁，请稍后重试')
// 搜索接口更严格: 30 req/min per IP
const searchLimiter = createRateLimiter(30, 60 * 1000, '搜索请求过于频繁，请稍后重试')

// GET 请求签名验证
app.use(signatureAuth)

// 频率限制
app.use('/api/search', searchLimiter)
app.use('/api/', generalLimiter)

app.use(express.json({ limit: (config.upload.maxContentLength / 1024 / 1024) + 'mb' }))

// 静态文件服务 —— 为上传的图片提供访问
const UPLOAD_DIR = path.join(os.homedir(), 'dali_uploads')
app.use('/uploads', express.static(UPLOAD_DIR))

// 静态文件服务 —— 为种子图片提供访问
const IMAGES_DIR = path.join(__dirname, 'images')
app.use('/images', express.static(IMAGES_DIR))

// ============================================================
// 数据库迁移检测（启动时自动检查并提示）
// ============================================================
async function checkMigrations() {
  try {
    const [row] = await query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'live_posts'
         AND COLUMN_NAME IN ('point_id', 'point_name')`
    )
    if (row.cnt < 2) {
      console.warn('')
      console.warn(' ╔══════════════════════════════════════════════════════════╗')
      console.warn(' ║  ⚠️  数据库迁移未执行！                              ║')
      console.warn(' ║  live_posts 表缺少 point_id / point_name 字段。       ║')
      console.warn(' ║                                                      ║')
      console.warn(' ║  请执行以下 SQL 迁移脚本：                            ║')
      console.warn(' ║  mysql -u root -p your_db < scripts/migrate_live_posts_points.sql ║')
      console.warn(' ║                                                      ║')
      console.warn(' ║  或者直接执行：                                       ║')
      console.warn(' ║  ALTER TABLE live_posts                               ║')
      console.warn(' ║    ADD COLUMN point_id   VARCHAR(20) DEFAULT "",       ║')
      console.warn(' ║    ADD COLUMN point_name VARCHAR(200) DEFAULT "";      ║')
      console.warn(' ╚══════════════════════════════════════════════════════════╝')
      console.warn('')
    } else {
      console.log('✅ 数据库迁移状态正常 (live_posts 包含 point_id / point_name)')
    }

    // 检查 scenic_spots 表是否存在
    const [spotCheck] = await query(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scenic_spots'`
    )
    if (spotCheck.cnt === 0) {
      console.warn('')
      console.warn(' ╔══════════════════════════════════════════════════════════╗')
      console.warn(' ║  ⚠️  scenic_spots 表不存在！                        ║')
      console.warn(' ║                                                      ║')
      console.warn(' ║  请执行景区管理迁移脚本：                              ║')
      console.warn(' ║  mysql -u root -p dali_now < scripts/migrate_scenic_spots.sql ║')
      console.warn(' ╚══════════════════════════════════════════════════════════╝')
      console.warn('')
    } else {
      // 检查 checkin_points 是否有 scenic_spot_id
      const [cpCheck] = await query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'checkin_points'
           AND COLUMN_NAME = 'scenic_spot_id'`
      )
      if (cpCheck.cnt === 0) {
        console.warn('')
        console.warn(' ╔══════════════════════════════════════════════════════════╗')
        console.warn(' ║  ⚠️  checkin_points 缺少 scenic_spot_id 字段！     ║')
        console.warn(' ║  请执行: ALTER TABLE checkin_points                   ║')
        console.warn(' ║    ADD COLUMN scenic_spot_id INT DEFAULT NULL;          ║')
        console.warn(' ╚══════════════════════════════════════════════════════════╝')
        console.warn('')
      } else {
        console.log('✅ 景区管理相关表状态正常')
      }
    }
  } catch (e) {
    // 静默：可能 information_schema 不可访问，或表尚未创建
  }
}

// 启动时检查（不阻塞路由注册）
checkMigrations()

// 路由（各 POST 路由内部已注入敏感词过滤中间件）
app.use('/api/districts',     require('./routes/districts'))
app.use('/api/activities',    require('./routes/activities'))
app.use('/api/checkin',       require('./routes/checkin'))
app.use('/api/scenic-spots',  require('./routes/scenic-spots'))
app.use('/api/live',          require('./routes/live'))
app.use('/api/community',     require('./routes/community'))
app.use('/api/photos',        require('./routes/photos'))
app.use('/api/locallife',     require('./routes/locallife'))
app.use('/api/user',          require('./routes/user'))
app.use('/api/search',        require('./routes/search'))
app.use('/api/config',        require('./routes/config'))
app.use('/api/sensitive',      require('./routes/sensitive'))
app.use('/api/upload',         require('./routes/upload'))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

const PORT = require('./config').port || 3000
app.listen(PORT, () => {
  console.log(`✅ 大理此刻 API 服务已启动: http://0.0.0.0:${PORT}`)
  console.log(`   健康检查: http://0.0.0.0:${PORT}/api/health`)
})
