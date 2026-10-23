/**
 * 服务端敏感词过滤中间件
 * ============================================================
 * 词库来源: MySQL sensitive_words 表（不在代码中明文存储）
 * 服务启动时自动加载，之后通过 reloadFromDB() 热更新
 *
 * 用法:
 *   const { createSensitiveFilter, reloadFromDB } = require('./middleware/sensitive-filter')
 *   app.post('/api/live/posts', createSensitiveFilter(['content']), handler)
 */

const { query } = require('../db')
const config = require('../config')

// ==================== DFA 引擎 ====================

const dfa = { root: {} }
const MIN_MATCH_LENGTH = config.sensitiveFilter.minMatchLength

function buildDfa(words) {
  const root = {}
  for (const word of words) {
    // 跳过单字词（它们几乎全是误报源）
    if (!word || word.length < MIN_MATCH_LENGTH) continue
    let node = root
    for (const ch of word) {
      if (!node[ch]) node[ch] = {}
      node = node[ch]
    }
    node._end = true
  }
  return root
}

// 扫描文本，返回命中列表
function scanText(text) {
  if (!text || typeof text !== 'string') return []

  const root = dfa.root
  if (Object.keys(root).length === 0) return []

  const hits = []
  const len = text.length
  let i = 0

  while (i < len) {
    let node = root
    let j = i
    let matchEnd = -1

    while (j < len && node[text[j]]) {
      node = node[text[j]]
      j++
      if (node._end) matchEnd = j
    }

    if (matchEnd > i) {
      hits.push(text.substring(i, matchEnd))
      i = matchEnd
    } else {
      i++
    }
  }

  return hits
}

// ==================== 从 DB 加载词库 ====================
let _loaded = false

async function loadFromDB() {
  try {
    const rows = await query(
      'SELECT word FROM sensitive_words WHERE enabled = 1 ORDER BY id ASC'
    )
    const words = rows.map(r => r.word)
    dfa.root = buildDfa(words)
    _loaded = true
  } catch (e) {
    // 首次加载失败时保留旧词库，不中断服务
  }
}

// 热更新词库（管理员增删词后调用）
async function reloadFromDB() {
  await loadFromDB()
  return Object.keys(dfa.root).length
}

// 获取当前已加载的词数（调试用）
function getWordCount() {
  return Object.values(dfa.root).filter(n => n._end === undefined).length
}

// 确保词库已加载
async function ensureLoaded() {
  if (!_loaded) await loadFromDB()
}

// 启动时立刻加载
loadFromDB()

// ==================== Express 中间件 ====================

const DEFAULT_TEXT_FIELDS = config.sensitiveFilter.defaultTextFields

function createSensitiveFilter(fields = DEFAULT_TEXT_FIELDS) {
  return (req, res, next) => {
    const body = req.body
    if (!body || typeof body !== 'object') return next()

    let allHits = []

    for (const field of fields) {
      const value = body[field]
      if (typeof value === 'string') {
        const hits = scanText(value)
        if (hits.length > 0) {
          allHits.push({ field, hits })
        }
      }
    }

    if (allHits.length > 0) {
      const details = allHits
        .map(f => `[${f.field}] ${f.hits.join('、')}`)
        .join('; ')
      return res.json({ code: -1, msg: `内容包含敏感词: ${details}` })
    }

    next()
  }
}

module.exports = { createSensitiveFilter, scanText, reloadFromDB, getWordCount, ensureLoaded }
