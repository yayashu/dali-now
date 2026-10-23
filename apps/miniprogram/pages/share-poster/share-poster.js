/**
 * 分享海报页面 — V5 杂志级设计版
 *
 * 设计理念：一眼抓住眼球 · 杂志封面质感 · 层次分明
 * 布局（从上到下）：
 *   0. 封面级引语区（大标题 + 副标题 + 几何装饰线）
 *   1. 多图展示区
 *   2. 用户信息条（极简）
 *   3. 正文内容
 *   4. 活动详情卡
 *   5. 打卡点详情卡
 *   6. 底部品牌区
 */
const app = getApp()
const db = require('../../utils/db.js')

// ══════════════════════════════════
// 配色体系
// ══════════════════════════════════
// 小程序码图片（放在项目 images/ 目录下）
const QRCODE_IMG = '/images/miniprogram-code.jpg'

const C = {
  canvasW: 630,
  pad: 32,
  contentW: 630 - 64,
  radius: 16,

  // 主色系 — 深墨绿
  primary: '#0d5a3a',
  primaryLight: '#e8f2ec',
  primaryMuted: '#3d7a5a',

  // 文字层级
  title: '#1a2e24',       // 最深 — 标题
  body: '#3a3a3a',        // 正文
  meta: '#8a9490',        // 辅助信息
  faint: '#c5cdc8',       // 极淡

  // 卡片背景
  cardBg: '#ffffff',
  pageBg: '#f0f2f0',
  actBg: '#f6faf7',
  ptBg: '#f6f8fb',

  // 强调色
  accent: '#b8956a',      // 琥珀金 — 装饰点缀
  tagBg: '#eaf3ee',
}

// 图片网格常量
const IMG_GAP = 10
const IMG_SINGLE_H = 340
const IMG_DOUBLE_H = 210
const IMG_GRID_H = 160

// ══════════════════════════════════
// 文艺引语池 — 双行结构：主标题 + 副标题
// 每次随机选一条，保证有足够视觉分量
// ══════════════════════════════════
const HEADER_QUOTES = [
  {
    main: '风花雪月，此刻即永恒',
    sub: '在大理，时间会自己慢下来'
  },
  {
    main: '有些地方，去过一次就忘不掉',
    sub: '苍山不墨千秋画，洱海无弦万古琴'
  },
  {
    main: '把脚步放慢，把心打开',
    sub: '去有风的地方，做自由的自己'
  },
  {
    main: '山水之间，自有答案',
    sub: '我在大理，与时光对坐'
  },
  {
    main: '一半烟火，一半诗意',
    sub: '人间值得，这里更值得'
  },
  {
    main: '旅行不是抵达某处',
    sub: '而是出发那一刻的心动'
  },
  {
    main: '洱海不是海',
    sub: '却装下了所有关于远方的想象'
  },
  {
    main: '让每一帧风景成为记忆的锚点',
    sub: '真实在场，即时纪实'
  },
  {
    main: '山不见我，我自去见山',
    sub: '在海拔两千公尺听云的声音'
  },
  {
    main: '风吹过古城的时候',
    sub: '故事正在发生，而你在场'
  },
  {
    main: '这一秒的大理',
    sub: '只属于此刻正在看风景的你'
  },
  {
    main: '世界很大，但大理刚好',
    sub: '不远不近，不慌不忙'
  }
]

function pickHeader() {
  return HEADER_QUOTES[Math.floor(Math.random() * HEADER_QUOTES.length)]
}

// ── 用户身份诗意标签 ──
const TRAVELER_LABELS = [
  '在大理的旅人',
  '此刻的行者',
  '山水间的记录者',
  '古城里的漫游者',
  '苍洱之间的过客',
  '有风地方的拾光人',
  '把日子过成诗的旅居者',
  '与云对坐的闲人',
  '不赶时间的流浪者',
  '流浪在大理的野生诗人'
]

function pickTravelerLabel() {
  return TRAVELER_LABELS[Math.floor(Math.random() * TRAVELER_LABELS.length)]
}


Page({
  data: {
    posterUrl: '',
    loadError: '',
    canvasWidth: C.canvasW,
    canvasHeight: 1000,

    postId: '',
    userAvatar: '',
    userName: '',
    content: '',
    contentLines: [],
    images: [],
    location: '',
    postTime: '',

    activityDetail: null,
    pointDetail: null,

    avatarLoaded: true,
    activityCoverLoaded: false,
    preloadImages: [],
    postImageLoaded: false,

    drawing: false,
    drawDone: false
  },

  onLoad(options) {
    wx.showLoading({ title: '生成中...', mask: true })

    const postId = options.id || ''
    const userAvatar = decodeURIComponent(options.avatar || '')
    const userName = decodeURIComponent(options.userName || '旅行者')
    const content = decodeURIComponent(options.content || '')
    const imagesStr = decodeURIComponent(options.images || '')
    const activityId = options.activityId ? decodeURIComponent(options.activityId) : ''
    const pointId = options.pointId ? decodeURIComponent(options.pointId) : ''
    const location = decodeURIComponent(options.location || '')
    const postTime = decodeURIComponent(options.time || '')

    const imageUrls = imagesStr ? imagesStr.split(',').filter(u => u && u.trim()).slice(0, 4) : []

    let activityDetail = null, pointDetail = null, activityCoverUrl = ''

    try {
      if (activityId) {
        activityDetail = db.getById(db.TABLES.ACTIVITIES, activityId)
        if (activityDetail && activityDetail.cover) {
          activityCoverUrl = db.toAbsoluteUrl(activityDetail.cover)
        }
      }
      if (pointId) {
        pointDetail = db.getById(db.TABLES.CHECKIN_POINTS, pointId)
      }
    } catch (e) {
      console.warn('查询活动/打卡点缓存失败', e)
    }

    const preloadImages = []
    imageUrls.forEach((url, idx) => {
      preloadImages.push({ src: url, index: idx })
    })
    if (activityCoverUrl) {
      preloadImages.push({ src: activityCoverUrl, index: 99 })
    }

    const contentLines = this._wrapText(content, C.contentW, 15, 26)

    this.setData({
      postId, userAvatar, userName, content, contentLines, images: imageUrls,
      location, postTime, activityDetail, pointDetail, activityCoverUrl,
      headerInfo: pickHeader(),
      travelerLabel: pickTravelerLabel(),
      preloadImages,
      postImageLoaded: imageUrls.length === 0,
      activityCoverLoaded: !activityCoverUrl
    }, () => this._checkAndDraw())

    this._drawTimer = setTimeout(() => {
      if (!this.data.drawDone && !this.data.drawing) {
        this.setData({
          avatarLoaded: true, postImageLoaded: true, activityCoverLoaded: true
        }, () => this._checkAndDraw())
      }
    }, 5000)
  },

  onAvatarLoad() {},
  onAvatarError() {},

  onPreloadImgLoad(e) {
    const idx = e.currentTarget.dataset.index
    if (idx === 99) this.setData({ activityCoverLoaded: true }, () => this._checkAndDraw())
    else if (idx === 0) this.setData({ postImageLoaded: true }, () => this._checkAndDraw())
  },
  onPreloadImgError(e) {
    const idx = e.currentTarget.dataset.index
    if (idx === 99) this.setData({ activityCoverLoaded: true }, () => this._checkAndDraw())
    else if (idx === 0) this.setData({ postImageLoaded: true }, () => this._checkAndDraw())
  },

  _checkAndDraw() {
    if (this.data.drawDone || this.data.drawing) return
    const { images, activityCoverUrl } = this.data
    const imageReady = images.length === 0 || this.data.postImageLoaded
    const coverReady = !activityCoverUrl || this.data.activityCoverLoaded
    if (imageReady && coverReady) {
      setTimeout(() => { this._drawPoster() }, 150)
    }
  },

  // ════════════════════════════════════════
  // 核心绘制
  // ════════════════════════════════════════
  async _drawPoster() {
    if (this.data.drawDone || this.data.drawing) return
    this.setData({ drawing: true })
    wx.hideLoading()

    try {
      const canvasNode = await this._getCanvasNode()
      const ctx = canvasNode.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio || 2

      // 加载图片
      const imgList = []
      for (const url of this.data.images) {
        try { imgList.push(await this._loadCanvasImage(canvasNode, url)) } catch (_) {}
      }
      // 加载小程序码图
      let qrcodeImg = null
      try { qrcodeImg = await this._loadCanvasImage(canvasNode, QRCODE_IMG) } catch (_) {}

      let actCoverImg = null
      if (this.data.activityCoverUrl) {
        try { actCoverImg = await this._loadCanvasImage(canvasNode, this.data.activityCoverUrl) } catch (_) {}
      }

      const W = C.canvasW
      const P = C.pad
      const CW = C.contentW

      // ── 计算各区块高度 ──
      const imgN = imgList.length
      let imgH = 0
      if (imgN === 1) imgH = IMG_SINGLE_H
      else if (imgN === 2) imgH = IMG_DOUBLE_H
      else if (imgN >= 3) imgH = IMG_GRID_H * 2 + IMG_GAP

      const hdrInfo = this.data.headerInfo
      const actInfo = this.data.activityDetail
      const ptInfo = this.data.pointDetail

      // 头部区高度
      const headH = (hdrInfo && hdrInfo.main) ? 90 : 0

      // 用户信息条
      const userH = 82

      // 正文
      const contentH = this.data.contentLines.length > 0
        ? this.data.contentLines.length * 26 + 14
        : 0

      // 活动卡
      let actH = 0
      if (actInfo && actInfo.name) {
        actH = 52  // 标题 + type
        if (actInfo.description) {
          const dl = this._wrapText(actInfo.description, CW - 28, 12, 18).slice(0, 2)
          actH += dl.length * 18 + 6
        }
        if (actInfo.tags && actInfo.tags.length > 0) actH += 22
        actH += 20  // meta + padding
      }

      // 打卡点卡
      let ptH = 0
      if (ptInfo && ptInfo.name) {
        ptH = 46  // 标题
        const ptText = ptInfo.description || ptInfo.tips || ''
        if (ptText) {
          const pl = this._wrapText(ptText, CW - 28, 12, 17).slice(0, 2)
          ptH += pl.length * 17 + 4
        }
        if (ptInfo.best_time || ptInfo.crowd_level || ptInfo.composition) ptH += 18
        ptH += 14
      }

      // 底部品牌区
      const footerH = 130

      const totalInner =
        (headH ? headH + 18 : 0) +
        (imgN > 0 ? imgH + 18 : 0) +
        userH + 10 +
        contentH + (contentH > 0 ? 10 : 0) +
        actH + (actH > 0 ? 10 : 0) +
        ptH +
        16 +
        footerH

      const totalH = 16 + totalInner + 16
      this.setData({ canvasHeight: Math.ceil(totalH) })

      canvasNode.width = W * dpr
      canvasNode.height = totalH * dpr
      ctx.scale(dpr, dpr)

      // 背景
      ctx.clearRect(0, 0, W, totalH)
      ctx.fillStyle = C.pageBg
      ctx.fillRect(0, 0, W, totalH)

      // 白色主卡片
      const cardY = 16
      const cardH = totalInner
      this._rRect(ctx, 0, cardY, W, cardH, C.radius)
      ctx.fillStyle = C.cardBg
      ctx.fill()
      // 卡片阴影
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.06)'
      ctx.shadowBlur = 40
      ctx.shadowOffsetY = 8
      this._rRect(ctx, 0, cardY, W, cardH, C.radius)
      ctx.fill()
      ctx.restore()

      let y = cardY + 20

      // ═══════════════════════════════
      // ① 封面引语区
      // ═══════════════════════════════
      if (hdrInfo && hdrInfo.main) {
        y = this._drawHeader(ctx, hdrInfo, P, y, CW)
      }

      // ═══════════════════════════════
      // ② 多图区
      // ═══════════════════════════════
      if (imgList.length > 0) {
        y = this._drawImageGrid(ctx, imgList, P, y, CW)
        y += 18
      }

      // ═══════════════════════════════
      // ③ 用户身份区 — 杂志排版感
      // ═══════════════════════════════
      const dn = this.data.userName || '旅行者'
      const tl = this.data.travelerLabel || '在大理的旅人'
      const loc = this.data.location || ''
      const timeStr = this.data.postTime || ''

      const centerX = P + CW / 2
      const _uy = y

      // 顶部装饰线组：短线 + 菱形 + 短线
      ctx.strokeStyle = C.accent
      ctx.lineWidth = 0.6
      const lineW = 40
      ctx.beginPath()
      ctx.moveTo(centerX - lineW - 16, _uy + 4)
      ctx.lineTo(centerX - 16, _uy + 4)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(centerX + 16, _uy + 4)
      ctx.lineTo(centerX + lineW + 16, _uy + 4)
      ctx.stroke()
      // 中心菱形
      ctx.fillStyle = C.accent
      ctx.save()
      ctx.translate(centerX, _uy + 4)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-2.5, -2.5, 5, 5)
      ctx.restore()

      // 诗意标签
      ctx.fillStyle = C.accent
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(tl, centerX, _uy + 24)

      // 用户名（大字）
      ctx.fillStyle = C.title
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(dn, centerX, _uy + 46)

      // ── 状态行：分段绘制，互不重叠 ──
      const statusStr = '此刻在场'
      const sep = ' · '

      // ★ 关键：先还原左对齐并统一字体，避免度量/绘制不一致
      ctx.textAlign = 'start'
      const statusFont = 'bold 11px sans-serif'
      const metaFont = '11px sans-serif'

      // 先度量各段宽度（与绘制时完全一致）
      ctx.font = statusFont
      const dotW = 12                                           // ● + 间距（偏紧会挤）
      const statusW = ctx.measureText(statusStr).width          // "此刻在场"
      ctx.font = metaFont
      const sepW = ctx.measureText(sep).width                   // " · "
      const locW = loc ? ctx.measureText(loc).width : 0
      const timeW = timeStr ? ctx.measureText(timeStr).width : 0

      // 总视觉宽度
      let totalW = dotW + statusW
      if (locW > 0) totalW += sepW + locW
      if (timeW > 0) totalW += sepW + timeW
      const startX = centerX - totalW / 2
      let cursorX = startX

      // ● 绿点
      ctx.fillStyle = C.primary
      ctx.beginPath()
      ctx.arc(cursorX + 5, _uy + 67, 3.5, 0, Math.PI * 2)
      ctx.fill()
      cursorX += dotW

      // 此刻在场
      ctx.fillStyle = C.primary
      ctx.font = statusFont
      ctx.fillText(statusStr, cursorX, _uy + 71)
      cursorX += statusW

      // 地点
      if (locW > 0) {
        ctx.fillStyle = C.meta
        ctx.font = metaFont
        ctx.fillText(sep + loc, cursorX, _uy + 71)
        cursorX += sepW + locW
      }

      // 时间
      if (timeW > 0) {
        ctx.fillStyle = C.meta
        ctx.font = metaFont
        ctx.fillText(sep + timeStr, cursorX, _uy + 71)
      }

      y += userH + 10

      // ═══════════════════════════════
      // ④ 正文
      // ═══════════════════════════════
      if (this.data.contentLines.length > 0) {
        for (let i = 0; i < this.data.contentLines.length; i++) {
          ctx.fillStyle = C.body
          ctx.font = '14px sans-serif'
          ctx.fillText(this.data.contentLines[i], P, y + i * 26 + 14)
        }
        y += this.data.contentLines.length * 26 + 10
      }

      // ═══════════════════════════════
      // ⑤ 活动详情卡
      // ═══════════════════════════════
      if (actInfo && actInfo.name) {
        y = this._drawActivityCard(ctx, actInfo, actCoverImg, P, y, CW)
      }

      // ═══════════════════════════════
      // ⑥ 打卡点详情卡
      // ═══════════════════════════════
      if (ptInfo && ptInfo.name) {
        y = this._drawPointCard(ctx, ptInfo, P, y, CW)
      }

      // ═══════════════════════════════
      // ⑦ 底部品牌区
      // ═══════════════════════════════
      y += 16

      // 分隔线（两端渐隐效果用纯色替代）
      ctx.strokeStyle = C.faint
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(P + 40, y)
      ctx.lineTo(P + CW - 40, y)
      ctx.stroke()
      // 中心小菱形装饰
      ctx.fillStyle = C.primary
      const cx = W / 2, cy = y
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-3, -3, 6, 6)
      ctx.restore()
      y += 22

      // 品牌
      ctx.fillStyle = C.primary
      ctx.font = `bold 22px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('大理此刻', cx, y + 18)
      ctx.textAlign = 'start'

      ctx.fillStyle = C.meta
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('真实在场 · 即时纪实 · 氛围共享', cx, y + 36)
      ctx.textAlign = 'start'

      y += 48

      // ⑦-1 小程序码 — 真实图片
      const qrS = 70, qrX = cx - qrS / 2
      if (qrcodeImg && qrcodeImg.width > 0) {
        // 绘制真实小程序码
        ctx.save()
        this._rRect(ctx, qrX, y, qrS, qrS, 10)
        ctx.clip()
        ctx.drawImage(qrcodeImg, qrX, y, qrS, qrS)
        ctx.restore()
      } else {
        // 降级：占位框（图片加载失败时）
        ctx.strokeStyle = C.faint
        ctx.lineWidth = 1.2
        this._rRect(ctx, qrX, y, qrS, qrS, 8)
        ctx.stroke()
        ctx.fillStyle = C.primaryMuted
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('扫码体验', cx, y + qrS / 2 + 4)
        ctx.textAlign = 'start'
      }
      y += qrS + 8

      ctx.fillStyle = C.faint
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('长按识别小程序码 进入大理此刻', cx, y + 2)
      ctx.textAlign = 'start'

      // 导出
      const that = this
      wx.canvasToTempFilePath({
        canvas: canvasNode, x: 0, y: 0,
        width: W, height: totalH,
        destWidth: W * 2, destHeight: totalH * 2,
        fileType: 'jpg', quality: 0.92,
        success(res) {
          that.setData({ posterUrl: res.tempFilePath, drawing: false, drawDone: true })
          wx.hideLoading()
        },
        fail(err) {
          console.error('导出失败', err)
          that.setData({ loadError: '海报生成失败，请重试', drawing: false })
          wx.hideLoading()
        }
      })
    } catch (err) {
      console.error('绘制失败', err)
      this.setData({ loadError: '海报生成失败', drawing: false })
      wx.hideLoading()
    }
  },

  // ════════════════════════════════════════
  // ① 封面级引语区 — 杂志封面风格
  // ════════════════════════════════════════
  _drawHeader(ctx, hdr, x, y, w) {
    const cx = x + w / 2

    // 顶部细线 + 两侧小圆点装饰
    ctx.strokeStyle = C.accent
    ctx.lineWidth = 0.8
    const lineW = w * 0.35
    ctx.beginPath()
    ctx.moveTo(cx - lineW, y + 4)
    ctx.lineTo(cx + lineW, y + 4)
    ctx.stroke()
    // 两端小圆
    ctx.fillStyle = C.accent
    ctx.beginPath()
    ctx.arc(cx - lineW - 6, y + 4, 2, 0, Math.PI * 2)
    ctx.arc(cx + lineW + 6, y + 4, 2, 0, Math.PI * 2)
    ctx.fill()

    // 主标题 — 大号加粗居中
    ctx.fillStyle = C.title
    ctx.font = `bold 19px sans-serif`
    ctx.textAlign = 'center'
    const mainLines = this._wrapText(hdr.main, w - 20, 19, 28)
    for (let i = 0; i < mainLines.length; i++) {
      ctx.fillText(mainLines[i], cx, y + 32 + i * 28)
    }

    // 副标题 — 较小，主色
    const subY = y + 34 + mainLines.length * 28
    ctx.fillStyle = C.primaryMuted
    ctx.font = '12px sans-serif'
    const subLines = this._wrapText(hdr.sub || '', w - 30, 12, 19)
    for (let i = 0; i < subLines.length; i++) {
      ctx.fillText(subLines[i], cx, subY + i * 19)
    }

    ctx.textAlign = 'start'

    // 底部装饰：短横线 + 中心圆点
    const bottomY = y + 82
    ctx.strokeStyle = '#e0e6e2'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(cx - 50, bottomY)
    ctx.lineTo(cx - 8, bottomY)
    ctx.moveTo(cx + 8, bottomY)
    ctx.lineTo(cx + 50, bottomY)
    ctx.stroke()
    ctx.fillStyle = C.primary
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(cx, bottomY, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    return y + 90
  },

  // ════════════════════════════════════════
  // ⑤ 活动详情卡
  // ════════════════════════════════════════
  _drawActivityCard(ctx, act, coverImg, x, y, w) {
    const bp = 14
    const iw = w - bp * 2

    // 计算高
    let h = bp + 28  // pad + title
    if (act.type_name) h += 18
    if (act.description) {
      const dl = this._wrapText(act.description, iw, 12, 17).slice(0, 2)
      h += dl.length * 17 + 6
    }
    if (act.tags && act.tags.length > 0) h += 20
    h += 18  // meta
    h += bp

    // 背景
    ctx.fillStyle = C.actBg
    this._rRect(ctx, x, y, w, h, 12)
    ctx.fill()
    // 顶部色条
    ctx.fillStyle = C.primary
    this._rRect(ctx, x + 16, y, w - 32, 3, 1.5)
    ctx.fill()

    let iy = y + bp + 4

    // 标题
    ctx.fillStyle = C.title
    ctx.font = `bold 15px sans-serif`
    ctx.fillText('🎭 ' + (act.name || ''), x + bp, iy + 14)
    iy += 26

    // 类型标签
    if (act.type_name) {
      ctx.fillStyle = C.primaryMuted
      ctx.font = '10px sans-serif'
      ctx.fillText(act.type_name, x + bp, iy + 11)
      iy += 18
    }

    // 描述
    if (act.description) {
      const dl = this._wrapText(act.description, iw, 12, 17).slice(0, 2)
      ctx.fillStyle = '#555555'
      ctx.font = '12px sans-serif'
      for (let i = 0; i < dl.length; i++) {
        ctx.fillText(dl[i], x + bp, iy + 11 + i * 17)
      }
      iy += dl.length * 17 + 6
    }

    // 标签
    if (act.tags && act.tags.length > 0) {
      let tx = x + bp
      ctx.font = '10px sans-serif'
      for (const tag of act.tags.slice(0, 4)) {
        const t = '#' + (typeof tag === 'string' ? tag : (tag.tag || tag))
        const tw = ctx.measureText(t).width + 10
        if (tx + tw > x + bp + iw) break
        ctx.fillStyle = C.tagBg
        this._rRect(ctx, tx, iy, tw + 4, 18, 7)
        ctx.fill()
        ctx.fillStyle = C.primary
        ctx.fillText(t, tx + 6, iy + 12)
        tx += tw + 6
      }
      iy += 22
    }

    // Meta
    const mp = []
    if (act.date) mp.push('📅 ' + act.date)
    if (act.time_range) mp.push('⏰ ' + act.time_range)
    else if (act.time) mp.push('⏰ ' + act.time)
    if (act.location) mp.push('📍 ' + act.location)
    if (mp.length > 0) {
      ctx.fillStyle = C.meta
      ctx.font = '11px sans-serif'
      ctx.fillText(this._truncate(ctx, mp.join('  ·  '), iw, '11px sans-serif'), x + bp, iy + 11)
    }

    return y + h
  },

  // ════════════════════════════════════════
  // ⑥ 打卡点详情卡
  // ════════════════════════════════════════
  _drawPointCard(ctx, pt, x, y, w) {
    const bp = 14
    const iw = w - bp * 2

    let h = bp + 26
    const ptText = pt.description || pt.tips || ''
    if (ptText) {
      const pl = this._wrapText(ptText, iw, 12, 17).slice(0, 2)
      h += pl.length * 17 + 4
    }
    if (pt.best_time || pt.crowd_level || pt.composition) h += 18
    h += bp

    // 背景
    ctx.fillStyle = C.ptBg
    this._rRect(ctx, x, y, w, h, 12)
    ctx.fill()
    // 左竖条
    ctx.fillStyle = '#5a9bd6'
    this._rRect(ctx, x + 12, y + 10, 3.5, h - 20, 1.75)
    ctx.fill()

    let iy = y + bp + 2

    // 标题
    ctx.fillStyle = '#2a3a4a'
    ctx.font = `bold 14px sans-serif`
    ctx.fillText('📍 ' + (pt.name || ''), x + bp, iy + 12)
    iy += 26

    // 描述
    if (ptText) {
      const pl = this._wrapText(ptText, iw, 12, 17).slice(0, 2)
      ctx.fillStyle = '#666666'
      ctx.font = '12px sans-serif'
      for (let i = 0; i < pl.length; i++) {
        ctx.fillText(pl[i], x + bp, iy + 11 + i * 17)
      }
      iy += pl.length * 17 + 4
    }

    // Meta
    const pm = []
    if (pt.best_time) pm.push('📷 ' + pt.best_time)
    if (pt.crowd_level) pm.push('👥 ' + pt.crowd_level)
    if (pt.composition) pm.push('🖼 ' + pt.composition)
    if (pm.length > 0) {
      ctx.fillStyle = C.meta
      ctx.font = '10px sans-serif'
      ctx.fillText(this._truncate(ctx, pm.join('  |  '), iw, '10px sans-serif'), x + bp, iy + 10)
    }

    return y + h
  },

  // ════════════════════════════════════════
  // 工具方法
  // ════════════════════════════════════════

  _drawImageGrid(ctx, imgList, x, y, w) {
    const n = imgList.length, g = IMG_GAP
    if (n === 1) {
      this._drawOneImage(ctx, imgList[0], x, y, w, IMG_SINGLE_H)
      return y + IMG_SINGLE_H
    }
    if (n === 2) {
      const sw = (w - g) / 2
      this._drawOneImage(ctx, imgList[0], x, y, sw, IMG_DOUBLE_H)
      this._drawOneImage(ctx, imgList[1], x + sw + g, y, sw, IMG_DOUBLE_H)
      return y + IMG_DOUBLE_H
    }
    if (n >= 3) {
      const sw = (w - g) / 2, sh = IMG_GRID_H
      this._drawOneImage(ctx, imgList[0], x, y, sw, sh)
      this._drawOneImage(ctx, imgList[1], x + sw + g, y, sw, sh)
      const r2 = y + sh + g
      this._drawOneImage(ctx, imgList[2], x, r2, sw, sh)
      if (n >= 4) this._drawOneImage(ctx, imgList[3], x + sw + g, r2, sw, sh)
      return r2 + sh
    }
    return y
  },

  _drawOneImage(ctx, img, x, y, w, h) {
    ctx.save()
    this._rRect(ctx, x, y, w, h, 10)
    ctx.clip()
    const ir = img.width / img.height, ar = w / h
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (ir > ar) { sw = img.height * ar; sx = (img.width - sw) / 2 }
    else { sh = img.width / ar; sy = (img.height - sh) / 2 }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
    ctx.restore()
  },

  _getCanvasNode() {
    return new Promise((resolve, reject) => {
      let retry = 0
      const MAX = 3
      const go = () => {
        wx.createSelectorQuery().in(this)
          .select('#posterCanvas')
          .fields({ node: true, size: true })
          .exec(res => {
            if (res && res[0] && res[0].node) resolve(res[0].node)
            else if (retry < MAX) { retry++; setTimeout(go, 300) }
            else reject(new Error('无法获取Canvas'))
          })
      }
      go()
    })
  },

  _loadCanvasImage(canvasNode, src) {
    return new Promise((resolve, reject) => {
      try {
        const img = canvasNode.createImage()
        img.onload = () => { img.width && img.height ? resolve(img) : reject(new Error('size')) }
        img.onerror = () => reject(new Error('load'))
        img.src = src
      } catch (_) { reject(new Error('create')) }
    })
  },

  _wrapText(text, maxWidth, fontSize, lineHeight) {
    if (!text) return []
    const lines = []
    let cur = ''
    for (const ch of text) {
      const t = cur + ch
      let w = 0
      for (const c of t) w += c.charCodeAt(0) > 127 ? fontSize : fontSize * 0.55
      if (w > maxWidth && cur.length) { lines.push(cur); cur = ch }
      else cur = t
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  },

  _truncate(ctx, text, maxW, font) {
    ctx.save()
    ctx.font = font
    if (ctx.measureText(text).width <= maxW) { ctx.restore(); return text }
    let lo = 0, hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ctx.measureText(text.slice(0, mid) + '...').width <= maxW) lo = mid
      else hi = mid - 1
    }
    ctx.restore()
    return text.slice(0, lo) + '...'
  },

  _rRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },

  onSavePoster() {
    if (!this.data.posterUrl) return
    wx.getSetting({
      success: res => {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => this._doSave(),
            fail: () => wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许使用相册权限',
              confirmText: '去设置',
              success: m => { if (m.confirm) wx.openSetting() }
            })
          })
        } else this._doSave()
      }
    })
  },
  _doSave() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterUrl,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: () => wx.showToast({ title: '保存失败，请长按海报保存', icon: 'none' })
    })
  },

  retryDraw() {
    this.setData({ loadError: '', drawDone: false, posterUrl: '' })
    wx.showLoading({ title: '重新生成...', mask: true })
    this._checkAndDraw()
  },

  onShareAppMessage() {
    const { activityDetail, content } = this.data
    const title = activityDetail
      ? `我在大理「${activityDetail.name}」现场`
      : (content ? content.slice(0, 30) : '大理此刻 · 我在现场')
    return { title, path: '/pages/live/live', imageUrl: this.data.posterUrl || '' }
  },

  onUnload() {
    if (this._drawTimer) clearTimeout(this._drawTimer)
    this.setData({ posterUrl: '', userAvatar: '', preloadImages: [] })
  }
})
