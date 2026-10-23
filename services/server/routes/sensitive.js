/**
 * 敏感词库管理 & 预检 API
 * ============================================================
 * GET    /api/sensitive/check?text=xxx       — 预检文本（供前端调用）
 * GET    /api/sensitive/words                — 列出所有词（管理用）
 * POST   /api/sensitive/words                — 新增敏感词
 * POST   /api/sensitive/reload               — 从 DB 重新加载词库（批量导入后热更新）
 * DELETE /api/sensitive/words/:id            — 删除敏感词
 */
const router = require('express').Router()
const { query } = require('../db')
const { getPagination, paginatedData } = require('../utils')
const { scanText, reloadFromDB } = require('../middleware/sensitive-filter')

// 预检 — 前端发布前先调用此接口检查文本
router.get('/check', (req, res) => {
  const text = req.query.text || ''
  const hits = scanText(text)
  if (hits.length > 0) {
    res.json({ code: -1, passed: false, hits, msg: `内容包含 ${hits.length} 处敏感词` })
  } else {
    res.json({ code: 0, passed: true, hits: [], msg: 'ok' })
  }
})

// 获取所有敏感词 — 管理功能已屏蔽，返回空数据
router.get('/words', async (req, res) => {
  const { page, size } = getPagination(req)
  res.json({ code: 0, data: paginatedData([], 0, page, size) })
})

// 新增敏感词 — 管理功能已屏蔽
router.post('/words', async (req, res) => {
  res.json({ code: -1, msg: '敏感词管理功能已禁用' })
})

// 删除敏感词 — 管理功能已屏蔽
router.delete('/words/:id', async (req, res) => {
  res.json({ code: -1, msg: '敏感词管理功能已禁用' })
})

// 热更新 — 批量导入词库后从 DB 重新加载 DFA 引擎
router.post('/reload', async (req, res) => {
  try {
    const count = await reloadFromDB()
    res.json({ code: 0, msg: `词库已重新加载，当前词数: ${count}` })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
