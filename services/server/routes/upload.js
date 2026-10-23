/**
 * 图片上传路由
 * 支持 base64 方式上传（小程序端已压缩，服务端仅保存）
 */
const router = require('express').Router()
const path = require('path')
const fs = require('fs')
const os = require('os')
const { auth } = require('../middleware/auth')

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.homedir(), 'dali_uploads')
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])

// 确保上传目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// POST /api/upload/image_base64 — 通过 base64 上传图片（小程序用）
router.post('/image_base64', auth, async (req, res) => {
  try {
    const { data, ext } = req.body
    if (!data) {
      return res.json({ code: -1, msg: '缺少图片数据' })
    }

    const fileExt = (ext || 'jpg').toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(fileExt)) {
      return res.json({ code: -1, msg: '不支持的图片格式' })
    }

    // base64 解码
    const buffer = Buffer.from(data, 'base64')

    // 按月份分目录存储
    const dateDir = new Date().toISOString().slice(0, 7).replace('-', '')
    const dirPath = path.join(UPLOAD_DIR, dateDir)
    ensureDir(dirPath)

    const safeName = require('crypto').randomUUID() + '.' + fileExt
    const savePath = path.join(dirPath, safeName)
    fs.writeFileSync(savePath, buffer)

    const relPath = `uploads/${dateDir}/${safeName}`
    res.json({ code: 0, data: { url: relPath } })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
