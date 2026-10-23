const router = require('express').Router()
const { query } = require('../db')

// 获取配置项
router.get('/:key', async (req, res) => {
  try {
    const [row] = await query('SELECT `value` FROM app_config WHERE `key` = ?', [req.params.key])
    res.json({ code: 0, data: row ? row.value : null })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

// 设置配置项
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body
    await query(
      'INSERT INTO app_config (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
      [req.params.key, value, value]
    )
    res.json({ code: 0, msg: 'ok' })
  } catch (e) {
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
