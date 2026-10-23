const app = getApp()
const db = require('../../utils/db.js')
const sensitiveFilter = require('../../utils/sensitive-filter.js')
const { withTheme } = require('../../utils/util')

// 旅游主题趣味昵称推荐库
const TRAVEL_NICKNAMES = [
  '洱海追风人', '苍山漫步者', '大理拾光客', '风花雪月侠',
  '古城寻梦人', '环海骑行家', '云上大理客', '扎染手艺人',
  '三道茶旅人', '蝴蝶泉边客', '双廊落日猫', '沙溪旧时光',
  '喜洲麦田守望', '海舌公园浪子', '崇圣寺扫地僧', '无量山樱花侠',
  '南诏国探险家', '茶马古道骡子', '风城大理飘', '白族金花妹',
  '苍洱之间的人', '在下关等风来', '大理段氏后人', '古城北门溜达',
  '才村码头看海', '龙龛码头日出', '小普陀许愿人', '挖色码头追光',
  '金梭岛渔民', '玉几岛上发呆', '周城扎染姑娘', '鹤庆银匠小哥',
  '诺邓火腿猎人', '巍山一根面', '剑川木雕师傅', '鸡足山朝圣者',
  '海东追日落', '海西看日出', '风城浪子', '大理流浪记',
  '苍山十九峰', '洱海月下独酌', '下关风大别着凉', '上关花海蝴蝶',
  '大理土著阿鹏', '白族大本曲传人', '三月街赶集人', '绕三灵舞者',
  '火把节举火人', '本主庙许愿人', '苍山雪洱海月', '在云端数云朵',
  '石板路脚步声', '人民路卖唱', '洋人街喝咖啡', '床单厂看展'
]

// 从库中随机取一个昵称（避免和上次重复）
function getRandomNickname(exclude) {
  const pool = exclude ? TRAVEL_NICKNAMES.filter(n => n !== exclude) : TRAVEL_NICKNAMES
  return pool[Math.floor(Math.random() * pool.length)]
}

Page(withTheme({
  data: {
    statusBarHeight: 44,
    avatar: '',
    nickname: '',
    phone: '',
    originalNickname: '',
    originalPhone: ''
  },

  onLoad() {
    // 获取状态栏高度
    const sys = wx.getWindowInfo()
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 })

    // 从全局数据中读取当前用户信息
    const userInfo = app.globalData.userInfo || {}
    const storedPhone = wx.getStorageSync('userPhone') || ''
    const existingNickname = userInfo.nickname || userInfo.name || ''

    // 无昵称时随机推荐一个
    const nickname = existingNickname || getRandomNickname()

    this.setData({
      avatar: userInfo.avatar || '',
      nickname,
      phone: storedPhone,
      originalNickname: existingNickname,
      originalPhone: storedPhone
    })
  },

  // 自定义导航返回
  onNavBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 更换头像
  onChangeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.setData({ avatar: tempFilePath })
      }
    })
  },

  // 随机换一个昵称
  onRandomNickname() {
    this.setData({
      nickname: getRandomNickname(this.data.nickname)
    })
  },

  // 手动输入昵称
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 保存个人信息
  async onSave() {
    const { avatar, nickname, phone } = this.data

    if (!nickname || !nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    // 敏感词自动替换为 *（静默处理，不弹窗）
    const safeNickname = await sensitiveFilter.clean(nickname.trim())

    // 如果头像是临时路径，先上传到服务器获得永久 URL
    let finalAvatar = avatar
    if (avatar && (avatar.startsWith('wxfile://') || avatar.startsWith('http://tmp/'))) {
      try {
        wx.showLoading({ title: '上传头像中...', mask: true })
        const result = await db.uploadImage(avatar, 'avatar')
        finalAvatar = result.full_url || result.url || avatar
        wx.hideLoading()
      } catch (e) {
        wx.hideLoading()
        // 上传失败时仍用临时路径，但标记为可回退到默认头像
      }
    }

    // 保存到全局
    app.globalData.userInfo = {
      ...app.globalData.userInfo,
      avatar: finalAvatar,
      nickname: safeNickname,
      name: safeNickname
    }

    // 持久化存储
    wx.setStorageSync('userAvatar', finalAvatar || '')
    wx.setStorageSync('userNickname', safeNickname)
    if (phone) {
      wx.setStorageSync('userPhone', phone)
    }

    // 同步到数据库
    try {
      db.updateCurrentUser({
        nickname: safeNickname,
        avatar: finalAvatar || '',
        phone: phone
      })
    } catch (e) {
      // 数据库更新失败，本地已缓存
    }

    wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
    setTimeout(() => {
      wx.navigateBack()
    }, 1500)
  }
}))
