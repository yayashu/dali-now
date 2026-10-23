/**
 * 图片压缩工具 — 三档分场景压缩
 *
 * 头像:  宽≤400px, 高≤800px,  质量75 → 预期 ~10-25KB
 * 缩略图: 宽≤600px, 高≤1200px, 质量78 → 预期 ~20-45KB
 * 大图:   宽≤1200px,高≤2400px, 质量82 → 预期 ~80-180KB
 *
 * wx.compressImage 仅支持 compressedWidth，高度等比缩放。
 * 新增 maxHeight: 对于超长竖图，按高度反算所需宽度进行二次压缩。
 */

// ===== 压缩配置档位（从 config.js 统一读取）=====
const { imageProfiles, imageMaxWidth, imageQuality } = require('./config.js')
const PROFILES = {}
for (const [key, val] of Object.entries(imageProfiles)) {
  PROFILES[key] = { ...val, desc: key === 'avatar' ? '头像' : key === 'thumb' ? '缩略图' : '大图' }
}

// 保留旧常量向后兼容
const MAX_WIDTH = imageMaxWidth
const QUALITY = imageQuality

/**
 * 按指定类型压缩单张图片（推荐使用）
 * @param {string} src      - 图片临时路径
 * @param {'avatar'|'thumb'|'full'} type - 压缩类型
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressByType(src, type = 'thumb') {
  const profile = PROFILES[type] || PROFILES.thumb
  return compressImage(src, profile)
}

/**
 * 压缩单张图片（通用，支持自定义参数）
 * @param {string} src - 图片临时路径
 * @param {object} options - { maxWidth, maxHeight, quality }
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressImage(src, options = {}) {
  const maxWidth = options.maxWidth || MAX_WIDTH
  const maxHeight = options.maxHeight || maxWidth * 2
  const quality = options.quality || QUALITY

  return new Promise((resolve) => {
    wx.getImageInfo({
      src: src,
      success: (info) => {
        // 计算有效压缩宽度：同时满足宽高限制
        const effectiveWidth = calcEffectiveWidth(info.width, info.height, maxWidth, maxHeight)

        // 如果无需压缩，直接返回
        if (info.width <= effectiveWidth) {
          resolve(src)
          return
        }

        doCompress(src, effectiveWidth, quality, resolve)
      },
      fail: () => {
        resolve(src)
      }
    })
  })
}

/**
 * 根据宽高限制计算实际需要的压缩宽度
 * 取 min(maxWidth, maxHeight / originalHeight * originalWidth)
 */
function calcEffectiveWidth(origW, origH, maxW, maxH) {
  if (!origW || !origH) return maxW
  const widthForHeight = (maxH / origH) * origW
  return Math.min(maxW, widthForHeight)
}

/**
 * 执行压缩（支持高度超限时二次压缩）
 */
function doCompress(src, targetWidth, quality, resolve, depth) {
  depth = depth || 0
  wx.compressImage({
    src: src,
    quality: quality,
    compressedWidth: Math.round(targetWidth),
    success: (compressRes) => {
      // 若仍可能存在高度超限（最多二次压缩），检查结果尺寸
      if (depth === 0) {
        wx.getImageInfo({
          src: compressRes.tempFilePath,
          success: (info) => {
            if (info.height > targetWidth * 2.5) {
              // 高度仍超标，进一步压缩
              const tighter = (targetWidth * 2) / (info.height / targetWidth)
              doCompress(compressRes.tempFilePath, tighter, quality, resolve, depth + 1)
            } else {
              resolve(compressRes.tempFilePath)
            }
          },
          fail: () => resolve(compressRes.tempFilePath)
        })
      } else {
        resolve(compressRes.tempFilePath)
      }
    },
    fail: () => {
      resolve(src)
    }
  })
}

/**
 * 批量压缩图片（并行）
 * @param {string[]} paths - 图片路径数组
 * @param {object|string} options - 压缩选项对象，或类型字符串 'avatar'|'thumb'|'full'
 * @returns {Promise<string[]>} 压缩后的路径数组
 */
function compressImages(paths, options = {}) {
  if (!paths || paths.length === 0) return Promise.resolve([])
  if (typeof options === 'string' && PROFILES[options]) {
    return Promise.all(paths.map(p => compressByType(p, options)))
  }
  return Promise.all(paths.map(p => compressImage(p, options)))
}

module.exports = {
  compressImage,
  compressImages,
  compressByType,
  PROFILES,
  MAX_WIDTH,
  QUALITY
}
