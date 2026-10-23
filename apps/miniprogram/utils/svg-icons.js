// PNG 图标路径（替代 SVG base64 data URI）
// 微信小程序 <image> 组件在真机(尤其 Android)上不支持 SVG data URI，需使用 PNG 文件
var SVG_ICONS = {
  theme: '/images/icon-theme.png',
  calendar: '/images/icon-calendar.png',
  folk: '/images/icon-folk.png',
  sparkle: '/images/icon-sparkle.png',
  hot: '/images/icon-hot.png',
  distance: '/images/icon-distance.png',
  desc: '/images/icon-desc.png',
  empty: '/images/icon-empty.png',
  up: '/images/icon-up.png',
  heart: '/images/icon-heart.png'
}

module.exports = { SVG_ICONS }
