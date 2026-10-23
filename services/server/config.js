/**
 * 数据库 & 服务配置
 * 
 * 敏感信息通过环境变量注入，开发时可在项目根目录创建 .env 文件:
 *   DB_HOST=127.0.0.1
 *   DB_PORT=3306
 *   DB_USER=root
 *   DB_PASSWORD=your_password
 *   DB_NAME=dali_now
 *   SERVER_PORT=3000
 */
module.exports = {
  // MySQL 连接配置（优先从环境变量读取，带默认值兜底）
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dali_now',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // 服务端口
  port: parseInt(process.env.SERVER_PORT) || 3000,

  // ============================================================
  // 分页默认值
  // ============================================================
  pagination: {
    defaultPage: 1,
    defaultSize: 20,
    maxSize: 10000
  },

  // ============================================================
  // 上传配置
  // ============================================================
  upload: {
    maxContentLength: 10 * 1024 * 1024  // 10MB
  },

  // ============================================================
  // 敏感词过滤
  // ============================================================
  sensitiveFilter: {
    minMatchLength: 2,
    defaultTextFields: [
      'content', 'note', 'nickname', 'name', 'user_name',
      'activity_name', 'location', 'keyword', 'title', 'description', 'comment'
    ]
  },

  // ============================================================
  // 微信小程序配置
  // ============================================================
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || ''
  },

  // ============================================================
  // API 防滥用密钥（小程序端与服务端共享，用于请求签名）
  // ============================================================
  apiSecret: process.env.API_SECRET || '',
  signatureWindowSeconds: 300,  // 签名有效时间窗口 ±5分钟

  // 频率限制（每分钟每IP）
  rateLimit: {
    general: process.env.RATE_LIMIT_GENERAL || '100 per minute',
    search: process.env.RATE_LIMIT_SEARCH || '30 per minute'
  },

  // ============================================================
  // 默认值
  // ============================================================
  defaults: {
    nickname: '旅行者·大理'
  },

  // ============================================================
  // 图片处理参数
  // ============================================================
  imageProfiles: {
    cover:   { maxWidth: 1200, maxHeight: 2400, quality: 85 },
    gallery: { maxWidth: 1200, maxHeight: 2400, quality: 82 },
    thumb:   { maxWidth: 600,  maxHeight: 1200, quality: 80 }
  }
}
