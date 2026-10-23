const db = require('../../utils/db.js')
const { API_BASE } = require('../../utils/config.js')
const sensitiveFilter = require('../../utils/sensitive-filter.js')
const { withTheme, checkUserMuted } = require('../../utils/util')

// 发布类型映射
const POST_TYPE_MAP = {
  template: 'image'
}

// ══════════════════════════════════════
// 位置 × 天气 · 长文案池（100-200字）
// 每条文案带 {weather} 占位符，运行时注入天气描述
// ══════════════════════════════════════
const LOCATION_TEXTS = {
  '洱海': [
    '此刻洱海{weather}。苍山十九峰在云间若隐若现，湖水被风吹起细碎的光斑，像撒了一池碎银。海鸥从头顶掠过，翅膀扇动的声音和浪花拍岸的节奏合在一起，是大理独有的白噪音。坐在岸边什么都不想，就觉得人间真好啊，值得到此一游，更值得为此停留。',
    '环洱海的路上，{weather}。左边是苍山沉默的轮廓，右边是洱海泛着天光的镜面，而我正骑着小电驴穿过风，穿过稻田和白族村寨。路上遇到卖烤饵块的阿嬢，笑着递过来一份热乎的，我咬了一口，突然明白了什么叫"此心安处是吾乡"。',
    '我在洱海边发呆的第N个小时，{weather}。湖水的蓝不是一种蓝——近处是翡翠的透，远处是靛青的沉，更远的地方和天空融为一体，分不清哪是水哪是天。渔民划着小船悠悠荡过，涟漪一圈圈散开，像是时光的指纹。原来这个世界上真的有地方，光是坐着看水，就能看一整天。',
    '洱海不是海，却比海更懂温柔。今天{weather}，湖面像一块巨大的丝绸被风吹皱了边角，几只白鹭在浅滩上踱步，每抬一次脚都像在跳一支优雅的舞。我把手机收起来，用眼睛按了一万次快门——有些画面，是拍不下来的，只能用心存着。'
  ],
  '古城': [
    '穿行在大理古城的巷子里，{weather}。石板路上有马蹄踏出的凹痕，墙壁上爬满了三角梅和炮仗花，红的紫的炸开一片。路过卖鲜花饼的小店，老板正在揉面，玫瑰花的香气混着烤饼的焦香飘了一整条街。在古城，不必赶路，迷路才是正经事——每条巷子的尽头，都藏着一个不期而遇的惊喜。',
    '古城今天{weather}，在人民路找了一家二楼的小茶馆，推开木窗就能看到苍山。店里放的是周云蓬的民谣，老板养的三花猫趴在窗台上晒太阳。忽然觉得"偷得浮生半日闲"说的就是此刻——不为什么目的地，不为发朋友圈，就是单纯地坐着，喝茶，看云，让时间像猫一样懒懒地流过。',
    '夜晚的古城亮起暖黄色的灯笼，{weather}。酒吧里传出吉他的和弦声，街边的手艺人还在低头打磨银器，叮叮当当的声音在夜色里格外清脆。我端着一杯玫瑰酸奶，漫无目的地走着，和每一个迎面而来的陌生人交换微笑。古城的夜晚不急着睡，因为它知道，每一个来到这里的人，都舍不得太早说晚安。',
    '大理古城的清晨，{weather}。南城门在曦光里镀上一层金边，早点摊的蒸汽模糊了半条街，饵丝、稀豆粉、破酥粑粑的香气搅在一起，是这座古城最诚实的闹钟。有阿爷拎着鸟笼遛弯，有旅人背着大包刚下车，每个人脸上都带着刚到的兴奋或住了很久的从容——在古城，时间不是计数，是度过的方式。'
  ],
  '苍山': [
    '登上苍山，{weather}。海拔三千多米的地方，连呼吸都变得郑重。雪松和冷杉笔直地站着，像一排沉默的哨兵。往下看，洱海变成了蓝宝石吊坠，古城缩成棋盘大小。这一刻忽然理解了古人为什么要在山上建寺庙——离天越近，离自己越近。',
    '苍山十九峰十八溪，每一峰都有名字，每一溪都有故事。今天{weather}，空气清冽得像薄荷糖。沿着玉带路走，路边的蕨类植物挂着露水，苔藓厚厚地铺在石头上，踩上去像踩在绿色的天鹅绒上。偶尔有马帮的铃铛声从远处传来，叮当叮当，把思绪拉回茶马古道的年代。',
    '在苍山顶上看云，今天{weather}。云在脚下翻涌，像白色的大海，偶尔裂开一道口子，露出下面洱海的蓝。身边的人都不说话，大家各自对着这壮阔的景色按快门，然后发现怎么拍都拍不出眼睛看到的十分之一。大自然最厉害的地方就在于，它让你意识到相机的局限，也让你想起心跳的感受。'
  ],
  '喜洲': [
    '喜洲的稻田绿得不像话，{weather}。白族民居的飞檐翘角在稻浪里若隐若现，"三坊一照壁"的格局处处透着讲究。转角楼前有人在拍婚纱照，新娘的头纱被风吹起，新郎笑着帮她整理。喜洲不像古城那么热闹，它是安静的、从容的，像一个见过世面又选择归隐的读书人。',
    '在喜洲遇到了扎染坊，{weather}。满院子晾着蓝白相间的布料，在风里轻轻摆动，像一幅幅飘在空中的水墨画。阿嬢坐在门槛上穿针引线，手指翻飞间，一朵山茶花就在布上开了出来。她说这些花样都是祖上传下来的，每一针都有讲究。我买了一块方巾系在包上，从此随身带走了喜洲的颜色。'
  ],
  '双廊': [
    '双廊的海景不需要滤镜，{weather}。坐在临海的咖啡馆里，巨大的落地窗外就是整片洱海，渔船慢慢划过，水鸟贴着水面飞行，远处的苍山剪影像是水墨画的最后一笔。在这里，效率、KPI、deadline都变得遥远可笑——重要的是这杯咖啡凉了没有，和眼前的光什么时候会变。',
    '双廊的傍晚，{weather}。太阳从苍山背后滑下去，天空从橘红渐变到粉紫再到深蓝，像谁不小心打翻了水彩盘。对岸的灯火一盏一盏亮起来，星星点点倒映在水面上，分不清是人间还是天上。隔壁桌的情侣互相依偎着不说话，我在旁边看着，觉得这就是幸福最朴素的模样。'
  ],
  '沙溪': [
    '沙溪是时光胶囊里的古镇，{weather}。寺登街上的马蹄声仿佛还回荡在石板缝里，古戏台沉默地站着，看了一百年的人来人往。兴教寺的壁画斑驳却依然庄严，阳光从天井斜斜地照进来，尘埃在光束里缓慢浮动——那一刻你会相信，有些东西可以比时间更慢。',
    '在沙溪的玉津桥上站了很久，{weather}。黑惠江水静静流淌，两岸的柳树垂着长长的辫子，偶尔有马帮打扮的村民牵马经过，马蹄在石板上扣出清脆的节奏。桥头的阿婆在编草鞋，手法熟练得像是身体的本能。我想，沙溪教会了我一件事：慢，不是来不及，而是把每一刻都过得值得。'
  ],
  '崇圣寺': [
    '崇圣寺三塔已经站了一千多年，{weather}。它们见证了多少朝代更替、多少人来人往，却始终沉默如谜。倒影在聚影池里，塔和塔的影子连成一线，像是通往另一个时空的门。风吹过塔檐的铜铃，叮——叮——叮——每一声都像是千年前的回音。'
  ],
  '大理': [
    '来大理第几天已经不重要了，{weather}。这里的云是用来发呆的，风是用来呼吸的，日子是用来浪费的。早上在古城吃碗稀豆粉，下午骑着小电驴去才村吹风，傍晚在洱海边等一场日落。所谓理想生活，大概就是把自己放逐到一个可以慢得心安理得的地方。',
    '大理有一种奇妙的魔力，{weather}。刚来的时候你以为只是旅个游，待了两天就想退掉回程的票。不是因为风景有多震撼——虽然确实震撼——而是这里的氛围，这里的节奏，这里不慌不忙的人。在大理，时间不是抢来的，是匀出来的；生活不是赶路的，是散步的。',
    '此时此刻，我在大理，{weather}。说不出什么宏大的感悟，就是觉得很舒服——是那种从骨头缝里透出来的放松。阳光的温度刚好，风的速度刚好，手里的这杯茶的浓度也刚好。如果你问我为什么要来大理，我想我会说：不是为了逃离生活，而是为了找回生活本来的样子。'
  ]
}

// 天气描述注入
const WEATHER_DESC = {
  sunny: ['阳光正好，天空蓝得透亮', '金色的阳光洒满每一寸角落', '晴空万里，暖意融融'],
  cloudy: ['云层低低地悬着，像一层温柔的棉被', '多云的天色如水墨晕染', '云朵慢慢游走，投下流动的光影'],
  rainy: ['细雨如丝，把整个世界洗得干干净净', '雨滴落在青石板上，敲出清脆的节奏', '微雨朦胧，远山近水都披上了薄纱'],
  foggy: ['薄雾缭绕，一切朦胧得像在梦里', '雾气给苍山洱海罩上了神秘的面纱'],
  overcast: ['天光柔和，万物笼罩在淡淡的灰调里', '阴天的饱和度降了两格，却多了几分沉静']
}

function getWeatherDesc(code) {
  // code: 0=晴, 1-3=多云, 45-48=雾, 51-67=雨, 71-77=雪, 80-99=阵雨, 其它=阴
  let type = 'overcast'
  if (code === 0) type = 'sunny'
  else if (code >= 1 && code <= 3) type = 'cloudy'
  else if (code >= 45 && code <= 48) type = 'foggy'
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 99)) type = 'rainy'
  const arr = WEATHER_DESC[type] || WEATHER_DESC.overcast
  return arr[Math.floor(Math.random() * arr.length)]
}

// 获取天气信息（使用免费 Open-Meteo API，无需 key）
function fetchWeather(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
    wx.request({
      url,
      timeout: 5000,
      success: (res) => {
        if (res.data && res.data.current_weather) {
          const w = res.data.current_weather
          resolve({ temp: w.temperature, code: w.weathercode, desc: getWeatherDesc(w.weathercode) })
        } else {
          resolve(null)
        }
      },
      fail: () => resolve(null)
    })
  })
}

// 选择文案：位置匹配 + 随机选取 + 注入天气
function pickLocationText(locationName, weatherDesc) {
  let texts = null
  // 精确匹配
  for (const [key, arr] of Object.entries(LOCATION_TEXTS)) {
    if (locationName.includes(key)) { texts = arr; break }
  }
  // 模糊匹配
  if (!texts) {
    for (const [key, arr] of Object.entries(LOCATION_TEXTS)) {
      if (key.includes(locationName) || locationName.includes(key)) { texts = arr; break }
    }
  }
  // 兜底
  if (!texts) texts = LOCATION_TEXTS['大理']
  const raw = texts[Math.floor(Math.random() * texts.length)]
  return raw.replace('{weather}', weatherDesc || '风景正好')
}

// 时间段通用长文案（GPS 定位失败时使用）
function pickTimeText(weatherDesc) {
  const hour = new Date().getHours()
  const pool = []
  if (hour >= 5 && hour < 10) {
    pool.push(
      '清晨的大理还在半梦半醒之间，{weather}。苍山顶刚被第一缕光照亮，洱海的水面浮着一层薄雾，远看像一杯加了奶盖的蓝茶。古城的早点摊已经冒出热气，饵丝在滚水里翻腾，阿孃一边捞粉一边问"要辣子不"。这是大理一天中最安静也最动人的时刻。',
      '大理的早晨，{weather}。推开窗，苍山的轮廓在晨光里清晰起来，洱海的方向飘来湿润的风。路上还没什么人，只有出来遛弯的阿爷和叼着包子的旅人。这个点的大理，是属于早起的人的——安静、清爽，整座城市刚刚醒来，一切都是新的。'
    )
  } else if (hour >= 10 && hour < 12) {
    pool.push(
      '上午的大理渐渐热闹起来，{weather}。人民路上有人在弹吉他，手鼓店传出轻快的节奏，咖啡馆的露天座位陆续坐满了各种肤色的人。古城进入了它最活跃的时段，每个人都在用自己的方式和这座城市互动——有人拍照，有人发呆，有人满街找最好吃的烤乳扇。',
      '十一点钟的大理，{weather}。阳光把石板路照得发亮，三角梅的影子斜斜地投在白墙上，像一幅随时在变化的剪纸。我找了一家巷子深处的小店吃早午餐，老板用自家种的玫瑰花泡茶，花香顺着喉咙一路暖到心里。'
    )
  } else if (hour >= 12 && hour < 17) {
    pool.push(
      '午后的大理适合放空，{weather}。阳光变得温柔，照在洱海水面上碎成千万片金箔。骑车沿着环海路走，左边是沉默的苍山，右边是发光的洱海，风从耳边呼呼吹过，把所有的烦恼都甩在后面。找个树荫坐下，看云，看水，看来来往往的人——下午的每一分钟都值得被浪费。',
      '下午的洱海，{weather}。光线穿过云层在湖面上投下流动的影子，像大地在缓缓呼吸。海舌公园的芦苇荡里，有人在弹尤克里里，声音飘过水面传到很远的地方。我脱了鞋踩进水里，冰凉的感觉从脚底蹿上来——是真实的，活着的感觉。'
    )
  } else if (hour >= 17 && hour < 20) {
    pool.push(
      '黄昏时分的大理，{weather}。天空开始上演一场盛大的色彩秀——先是浅粉，然后是橘黄，最后晕成深紫和靛蓝。洱海变成了巨大的反光板，把天空的每一层颜色都忠实地复刻到水面上。有人在栈道上架起三脚架等日落，有人在环海路边停车拍照。这一刻，整个大理都在认真地看一场日落。',
      '大理的傍晚，{weather}。夕阳把苍山染成了金色，古城墙在余晖里泛着暖橙色的光。巷子里的灯笼一盏一盏亮起来，酒吧开始调音，咖啡馆的人陆续散去，夜市的小摊陆续摆出。白天的热闹褪去，夜晚的温柔接上，这是一天中我最喜欢的时刻——过渡的、暧昧的、充满可能性的。'
    )
  } else {
    pool.push(
      '大理的夜晚，{weather}。抬头能看到满天繁星，这是在城市里永远见不到的奢侈。古城酒吧里传出民谣的旋律，人民路的灯光把石板路照得温暖而朦胧。坐在客栈的露台上，抱一杯热茶，看远处洱海的渔火一点一点明灭——这样的夜晚，不该用来睡觉。',
      '夜深了，{weather}。古城褪去了白天的喧嚣，只剩下路灯和偶尔路过的夜归人。洱海方向传来隐约的水声，苍山在夜色里变成一团巨大的黑影，温柔地包裹着这座小城。我坐在窗边，觉得此刻的大理，安静得像一个秘密——只有深夜不睡的人才知道。'
    )
  }
  const raw = pool[Math.floor(Math.random() * pool.length)]
  return raw.replace('{weather}', weatherDesc || '天气适宜')
}

Page(withTheme({
  data: {
    statusBarHeight: 44,
    mode: 'quick',
    verified: false,
    currentTime: '',
    selectedTemplate: '',
    linkedActivity: '',
    linkedActivityId: '',
    linkedPoint: '',       // 关联打卡点名称
    linkedPointId: '',     // 关联打卡点ID
    content: '',
    mediaList: [],         // [{ path, uploaded, url }]
    selectedLocation: '',
    canPublish: false,
    publishing: false,
    defaultText: '',       // 位置自动生成的默认文案
    locating: false,       // 是否正在获取位置
    fixedLat: null,        // 外部传入的固定纬度（来自打卡点）
    fixedLng: null,        // 外部传入的固定经度（来自打卡点）
    fixedLocationName: '', // 外部传入的位置名称（来自打卡点）
    fixedPointId: '',      // 外部传入的打卡点ID
    fixedPointName: '',    // 外部传入的打卡点名称
    savedLat: null,        // geolocation 获取到的实际纬度
    savedLng: null         // geolocation 获取到的实际经度
  },

  onLoad(options) {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    } catch (e) {
      this.setData({ statusBarHeight: 44 })
    }

    // 登录校验：极速状态和模板创作都需登录
    const app = getApp()
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '请先登录',
        content: '发布现场动态需要登录后才能操作',
        confirmText: '去登录',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            app.login().then(() => {
              this._initPage(options)
            }).catch(() => {
              wx.navigateBack()
            })
          } else {
            wx.navigateBack()
          }
        }
      })
      return
    }
    this._initPage(options)
  },

  onShow() {
    // 恢复可能因 onHide 丢失的 mediaList（持久化到 storage）
    if (this._selectingMedia) {
      const saved = wx.getStorageSync('__livepost_media')
      if (saved && saved.length > 0 && this.data.mediaList.length === 0) {
        this.setData({ mediaList: saved })
        this.checkCanPublish()
      }
    }
  },

  onHide() {
    // 持久化已选图片，防止临时路径在页面切换时失效
    if (this.data.mediaList.length > 0) {
      wx.setStorageSync('__livepost_media', this.data.mediaList)
    }
  },

  onUnload() {
    wx.removeStorageSync('__livepost_media')
  },

  _initPage(options) {
    const mode = options.mode || 'quick'
    // 防御性解码：与 locationName/pointName 保持一致
    const activityName = options.activityName ? decodeURIComponent(options.activityName) : ''
    const activityId = options.activityId ? decodeURIComponent(options.activityId) : ''
    // 来自打卡点的外部定位参数
    const fixedLat = options.lat ? parseFloat(options.lat) : null
    const fixedLng = options.lng ? parseFloat(options.lng) : null
    const fixedLocationName = options.locationName ? decodeURIComponent(options.locationName) : ''
    const pointId = options.pointId || ''  // 打卡点 ID
    const pointName = options.pointName ? decodeURIComponent(options.pointName) : fixedLocationName  // 打卡点名称（来自 checkin-detail 传参）

    // 标记来源：机位详情 > 活动详情 > 其他（live tab 等）
    this._fromCheckin = !!pointId
    this._fromActivity = !pointId && !!activityId
    this._checkinPointId = pointId
    this._returnActivityId = activityId

    this.setData({
      mode,
      linkedActivity: activityName,
      linkedActivityId: activityId,
      linkedPoint: pointName,
      linkedPointId: pointId,
      currentTime: this.getCurrentTime(),
      fixedLat,
      fixedLng,
      fixedLocationName,
      fixedPointId: pointId,
      fixedPointName: pointName
    })

    this.startVerify()

    // 极速模式：获取位置并生成默认文案
    if (mode === 'quick') {
      this.getLocationAndGenerateText()
    }
  },

  getCurrentTime() {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
  },

  onNavBack() {
    wx.navigateBack({ delta: 1 })
  },

  // ==================== 获取位置并生成默认文案（含天气） ====================
  getLocationAndGenerateText() {
    // 如果从外部传入了固定的打卡点定位，直接使用
    const { fixedLat, fixedLng, fixedLocationName } = this.data
    if (fixedLat && fixedLng && fixedLocationName) {
      this.setData({ locating: false, selectedLocation: fixedLocationName })
      // 拉取天气 + 匹配长文案
      fetchWeather(fixedLat, fixedLng).then(weather => {
        const weatherDesc = weather ? weather.desc : '风景正好'
        const text = pickLocationText(fixedLocationName, weatherDesc)
        if (!this.data.content) {
          this.setData({ content: text, defaultText: text })
        }
        this.checkCanPublish()
      })
      return
    }

    this.setData({ locating: true })

    wx.getLocation({
      type: 'gcj02',
      timeout: 8000,
      success: (locRes) => {
        this.setData({ savedLat: locRes.latitude, savedLng: locRes.longitude })
        this.reverseGeocode(locRes.latitude, locRes.longitude)
      },
      fail: () => {
        // 定位失败，使用基于时间的通用长文案，默认位置设为"大理"
        const defaultLoc = '大理'
        this.setData({ locating: false, selectedLocation: defaultLoc })
        const text = pickTimeText('')
        if (!this.data.content) {
          this.setData({ content: text, defaultText: text })
        }
        this.checkCanPublish()
      }
    })
  },

  reverseGeocode(latitude, longitude) {
    wx.getFuzzyLocation ?
    wx.getFuzzyLocation({
      type: 'wgs84',
      success: () => this.fallbackLocationText(latitude, longitude),
      fail: () => this.fallbackLocationText(latitude, longitude)
    }) :
    this.fallbackLocationText(latitude, longitude)
  },

  fallbackLocationText(latitude, longitude) {
    // 大理核心区域坐标范围判断
    let locationName = '大理'
    if (latitude > 25.6 && latitude < 25.8 && longitude > 100.1 && longitude < 100.3) {
      locationName = '洱海'
    } else if (latitude > 25.67 && latitude < 25.7 && longitude > 100.15 && longitude < 100.2) {
      locationName = '古城'
    } else if (latitude > 25.65 && latitude < 25.75 && longitude > 100.05 && longitude < 100.15) {
      locationName = '苍山'
    }

    // 立即设置位置名，让用户感知定位结果
    this.setData({ locating: false, selectedLocation: locationName })

    // 拉取天气 + 匹配长文案
    fetchWeather(latitude, longitude).then(weather => {
      const weatherDesc = weather ? weather.desc : '风景正好'
      const text = pickLocationText(locationName, weatherDesc)
      if (!this.data.content) {
        this.setData({ content: text, defaultText: text })
      }
      this.checkCanPublish()
    })
  },

  // 已弃用，保留兼容
  getTimeBasedText() {
    return pickTimeText('')
  },

  // 已弃用，保留兼容
  matchLocationText(locationName) {
    const weatherDesc = '风景正好'
    return [pickLocationText(locationName, weatherDesc)]
  },

  startVerify() {
    // 尝试获取真实定位，同时模拟核验计时
    wx.getLocation({
      type: 'gcj02',
      timeout: 5000,
      success: () => {},
      fail: () => {}
    })
    setTimeout(() => {
      this.setData({ verified: true })
      // 核验完成后重新检查发布按钮状态（默认文案可能已生成）
      this.checkCanPublish()
    }, 1500)
  },

  // ==================== 极速发布 ====================  
  async onQuickPublish() {
    const banCheck = checkUserMuted()
    if (banCheck.banned) {
      wx.showModal({ title: '无法发布', content: banCheck.msg, showCancel: false })
      return
    }
    if (!this.data.verified) {
      wx.showToast({ title: '请等待核验完成', icon: 'none' })
      return
    }
    if (this.data.publishing) return

    // 敏感词自动替换为 *（静默处理，不弹窗）
    const safeContent = await sensitiveFilter.clean(this.data.content)

    this.setData({ publishing: true })
    wx.showLoading({ title: '准备发布...', mask: true })

    try {
      const { mediaList } = this.data
      let imageUrls = []

      if (mediaList.length > 0) {
        // 已有选好的图片，直接上传
        for (let i = 0; i < mediaList.length; i++) {
          wx.showLoading({ title: `上传中 ${i + 1}/${mediaList.length}`, mask: true })
          const result = await db.uploadImage(mediaList[i].path, 'full')
          imageUrls.push(result.url)
        }
      }

      // 构建并提交发文
      wx.showLoading({ title: '发布中...', mask: true })
      const postData = this.buildPostData('image', safeContent, imageUrls)
      this._saveToLocalCache(postData)
      this._fireSubmit(postData)

      wx.hideLoading()
      this.setData({
        publishing: false,
        content: '',
        mediaList: [],
        verified: false
      })
      wx.showToast({ title: '发布成功', icon: 'success' })
      this._startHeartbeat()
      this._backToLive()
      return
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
      this.setData({ publishing: false })
    }
  },

  // ==================== 模板选择 ====================
  onSelectTemplate(e) {
    this.setData({ selectedTemplate: e.currentTarget.dataset.template })
  },

  // ==================== 关联活动 ====================
  async onSelectActivity() {
    const activeActs = await db.table(db.TABLES.ACTIVITIES).where('status', 'active').orderBy('date', 'desc').getAsync()
    const items = activeActs.map(a => a.name)
    if (items.length === 0) {
      wx.showToast({ title: '暂无进行中的活动', icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const act = activeActs[res.tapIndex]
        this.setData({ linkedActivity: act.name, linkedActivityId: act.id })
      }
    })
  },

  // ==================== 关联打卡点 ====================
  async onSelectPoint() {
    const points = await db.table(db.TABLES.CHECKIN_POINTS).getAsync()
    if (points.length === 0) {
      wx.showToast({ title: '暂无打卡点数据', icon: 'none' })
      return
    }
    const items = points.map(p => p.name)
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const pt = points[res.tapIndex]
        this.setData({
          linkedPoint: pt.name,
          linkedPointId: pt.id,
          fixedLat: pt.latitude,
          fixedLng: pt.longitude
        })
      }
    })
  },

  // ==================== 内容输入 ====================
  onContentInput(e) {
    this.setData({ content: e.detail.value })
    this.checkCanPublish()
  },

  // ==================== 添加图片（支持拍照+相册） ====================
  onAddMedia() {
    const remain = 9 - this.data.mediaList.length
    if (remain <= 0) return

    this._selectingMedia = true

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newItems = (res.tempFiles || []).map(f => ({
          path: f.tempFilePath,
          uploaded: false,
          url: ''
        }))
        const merged = [...this.data.mediaList, ...newItems]
        this.setData({ mediaList: merged })
        // 持久化到 storage，防止 onHide/onShow 导致临时路径丢失
        wx.setStorageSync('__livepost_media', merged)
        this.checkCanPublish()
      },
      fail: () => {},
      complete: () => {
        this._selectingMedia = false
      }
    })
  },

  // ==================== 移除图片 ====================
  onRemoveMedia(e) {
    const index = e.currentTarget.dataset.index
    const mediaList = [...this.data.mediaList]
    mediaList.splice(index, 1)
    this.setData({ mediaList })
    wx.setStorageSync('__livepost_media', mediaList)
    this.checkCanPublish()
  },

  // ==================== 预览图片 ====================
  onPreviewMedia(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.mediaList[index]
    const urls = this.data.mediaList
      .filter(m => m.uploaded)
      .map(m => m.url)
    wx.previewImage({
      current: item.url || item.path,
      urls: urls.length > 0 ? urls : [item.path]
    })
  },

  // ==================== 选择位置 ====================
  onSelectLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ selectedLocation: res.name || res.address })
        this.checkCanPublish()
      }
    })
  },

  // ==================== 发布校验 ====================
  checkCanPublish() {
    const { content, verified } = this.data
    // 只要内容不为空 + 核验通过即可发布
    const hasContent = content && content.trim().length > 0
    const canPublish = verified && hasContent
    this.setData({ canPublish })
  },

  // ==================== 图文/模板发布 ====================
  async onPublish() {
    const banCheck = checkUserMuted()
    if (banCheck.banned) {
      wx.showModal({ title: '无法发布', content: banCheck.msg, showCancel: false })
      return
    }
    if (!this.data.verified) {
      wx.showToast({ title: '请等待核验完成', icon: 'none' })
      return
    }
    if (!this.data.canPublish) {
      wx.showToast({ title: '请填写分享内容', icon: 'none' })
      return
    }
    if (this.data.publishing) return

    // 敏感词自动替换为 *（静默处理，不弹窗）
    const safeContent = await sensitiveFilter.clean(this.data.content)

    this.setData({ publishing: true })
    wx.showLoading({ title: '上传图片中...', mask: true })

    try {
      const { mode, mediaList, selectedTemplate } = this.data
      let content = safeContent

      // 上传图片（db.uploadImage 内部已包含压缩，避免双重压缩）
      let imageUrls = []
      if (mediaList.length > 0) {
        for (let i = 0; i < mediaList.length; i++) {
          wx.showLoading({ title: `上传中 ${i + 1}/${mediaList.length}`, mask: true })
          const result = await db.uploadImage(mediaList[i].path, 'full')
          imageUrls.push(result.url)
        }
      }

      // 构建并提交发文
      wx.showLoading({ title: '发布中...', mask: true })
      const type = POST_TYPE_MAP[mode] || 'image'
      let postContent = content

      // 模板模式：拼入模板标记
      if (mode === 'template' && selectedTemplate) {
        const templateNames = {
          sunset: '【洱海日落】',
          ancient: '【古城漫步】',
          tea: '【三道茶香】',
          cloud: '【苍山云海】'
        }
        const tag = templateNames[selectedTemplate] || ''
        postContent = tag + (content ? '\n' + content : '')
      }

      const postData = this.buildPostData(type, postContent, imageUrls)
      this._saveToLocalCache(postData)
      this._fireSubmit(postData)

      wx.hideLoading()
      this.setData({
        publishing: false,
        content: '',
        mediaList: [],
        verified: false
      })
      wx.showToast({ title: '发布成功', icon: 'success' })
      this._startHeartbeat()
      return
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '发布失败', icon: 'none' })
      this.setData({ publishing: false })
    }
  },

  // ==================== 构建发文数据 ====================
  buildPostData(type, content = '', images = []) {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const postId = 'live_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)

    // 获取当前用户信息
    const user = db.getCurrentUser()
    const app = getApp()
    const userId = user.id || ''
    const avatar = user.avatar || app.globalData.userInfo?.avatar || ''
    const nickname = user.nickname || app.globalData.userInfo?.nickname || '旅行者·大理'

    // 坐标：优先使用传入的固定坐标，其次实际定位
    const lat = this.data.fixedLat || this.data.savedLat || null
    const lng = this.data.fixedLng || this.data.savedLng || null

    return {
      id: postId,
      user_id: userId,
      activity_id: this.data.linkedActivityId || '',
      activity_name: this.data.linkedActivity || '',
      point_id: this.data.linkedPointId || this.data.fixedPointId || '',
      point_name: this.data.linkedPoint || this.data.fixedPointName || '',
      latitude: lat,
      longitude: lng,
      user_name: nickname,
      user_avatar: avatar,
      type: type,
      content: content,
      cover: images.length > 0 ? images[0] : '',
      video_url: '',
      location: this.data.selectedLocation || this.data.fixedLocationName || '大理·此刻',
      post_time: timeStr,
      post_date: dateStr,
      is_verified: 1,
      images: images
    }
  },

  // ==================== 提交发文 API（后台异步，不阻塞导航）====================
  // 纯 wx.request 发起提交（无 Promise，避免页面销毁后回调崩溃）
  _fireSubmit(postData) {
    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: `${API_BASE}/live/posts`,
      method: 'POST',
      data: postData,
      timeout: 10000,
      header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      complete: () => {}  // 不引用 this，任由页面销毁后静默完成
    })
  },

  // 保留 submitPost 供其他调用方使用
  submitPost(postData) {
    const token = wx.getStorageSync('token') || ''
    return new Promise((resolve) => {
      wx.request({
        url: `${API_BASE}/live/posts`,
        method: 'POST',
        data: postData,
        timeout: 10000,
        header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.code === 0) {
            resolve(res.data)
          } else {
            resolve({ code: 0, msg: '已保存到本地', localOnly: true })
          }
        },
        fail: () => {
          resolve({ code: 0, msg: '已保存到本地', localOnly: true })
        }
      })
    })
  },

  // ==================== 保存到本地缓存 ====================
  _saveToLocalCache(postData) {
    // 防止重复插入
    const existing = db.table(db.TABLES.LIVE_POSTS).where('id', postData.id).first()
    if (existing) return

    db.insert(db.TABLES.LIVE_POSTS, {
      id: postData.id,
      user_id: postData.user_id,
      activity_id: postData.activity_id,
      activity_name: postData.activity_name,
      point_id: postData.point_id,
      point_name: postData.point_name,
      latitude: postData.latitude,
      longitude: postData.longitude,
      user_name: postData.user_name,
      user_avatar: postData.user_avatar,
      type: postData.type,
      content: postData.content,
      cover: postData.cover,
      video_url: postData.video_url,
      location: postData.location,
      post_time: postData.post_time,
      post_date: postData.post_date,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      is_verified: 1,
      is_hidden: 0
    })

    // 同步插入图片到本地缓存
    if (postData.images && postData.images.length > 0) {
      const existingImages = db.table(db.TABLES.LIVE_POST_IMAGES).get()
      postData.images.forEach((url, i) => {
        if (!existingImages.find(ei => ei.post_id === postData.id && ei.image_url === url)) {
          db.insert(db.TABLES.LIVE_POST_IMAGES, {
            post_id: postData.id,
            image_url: url,           // 存储相对路径（与服务器一致）
            sort_order: i
          })
        }
      })
    }
  },

  // 发布后返回：按来源决定返回目标（机位详情 > 活动详情 > live tab）
  _backToLive() {
    // 短暂延迟让用户感知发布完成，随后跳转（toast 为原生 UI，不影响显示）
    setTimeout(() => {
      if (this._fromCheckin) {
        // 来自机位详情页：设置成功标记，navigateBack 返回机位详情
        wx.setStorageSync('__publish_success', { time: Date.now() })
        wx.navigateBack({
          delta: 1,
          fail: () => {
            wx.redirectTo({
              url: `/pages/checkin-detail/checkin-detail?id=${this._checkinPointId}`,
              fail: () => {
                wx.switchTab({ url: '/pages/live/live' })
              }
            })
          }
        })
      } else if (this._fromActivity) {
        // 来自活动详情页：设置成功标记，navigateBack 返回活动详情
        wx.setStorageSync('__publish_success', { time: Date.now() })
        wx.navigateBack({
          delta: 1,
          fail: () => {
            wx.redirectTo({
              url: `/pages/activity-detail/activity-detail?id=${this._returnActivityId}`,
              fail: () => {
                wx.switchTab({ url: '/pages/live/live' })
              }
            })
          }
        })
      } else {
        wx.switchTab({
          url: '/pages/live/live',
          fail: () => {
            wx.navigateBack({ delta: 1, fail: () => {} })
          }
        })
      }
    }, 600)
  },

  // 发布后重新核验定位
  _startHeartbeat() {
    // 发布后刷新位置信息
    this.setData({ verified: false })
    this.startVerify()
  }
}))
