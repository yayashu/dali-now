const db = require('../../utils/db.js')
const { API_BASE, _generateGetSignature } = require('../../utils/config.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    checkinList: [],
    allCheckins: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,
    loaded: false
  },

  async onLoad() {
    await this.loadCheckins()
  },

  onShow() {
    if (this.data.loaded) {
      this.loadCheckins()
    }
  },

  async loadCheckins() {
    this.setData({ loading: true })

    try {
      const user = db.getCurrentUser()
      if (!user) {
        this.setData({ checkinList: [], loading: false, loaded: true })
        return
      }

      // 直接从 API 获取用户的打卡记录（服务端已 JOIN 打卡点信息）
      const checkinsUrl = `${API_BASE}/user/${user.id}/checkins`
      const checkinsSig = _generateGetSignature(checkinsUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: checkinsUrl,
          data: { size: 9999 },
          timeout: 8000,
          header: checkinsSig ? { 'X-Timestamp': checkinsSig.timestamp, 'X-Nonce': checkinsSig.nonce, 'X-Sign': checkinsSig.sign } : {},
          success: resolve,
          fail: reject
        })
      })

      let enrichedList = []
      if (res.data && res.data.code === 0 && res.data.data) {
        const rows = res.data.data.list || []
        // 同时加载打卡点缓存用于回填前端字段
        const allPoints = db.table(db.TABLES.CHECKIN_POINTS).get()
        const pointMap = {}
        for (const pt of allPoints) {
          pointMap[pt.id] = pt
        }

        enrichedList = rows.map(record => {
          const point = pointMap[record.checkin_id] || pointMap[record.point_id]
          return {
            ...record,
            pointName: record.point_name || (point ? point.name : '未知打卡点'),
            pointCover: record.point_cover
              ? db.toAbsoluteUrl(record.point_cover)
              : (point ? db.toAbsoluteUrl(point.cover || point.image_url) : ''),
            pointAddress: point ? point.address : '',
            checkinDate: (record.created_at || '').split(' ')[0]
          }
        })
      }

      // 分页切片
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayList = enrichedList.slice(0, page * pageSize)

      this.setData({
        allCheckins: enrichedList,
        checkinList: displayList,
        hasMore: displayList.length < enrichedList.length,
        loading: false,
        loaded: true
      })
    } catch (e) {
      this.setData({ checkinList: [], allCheckins: [], loading: false, loaded: true })
    }
  },

  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, allCheckins } = this.data
    const newPage = page + 1
    const displayList = allCheckins.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      checkinList: displayList,
      hasMore: displayList.length < allCheckins.length
    })
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      this.setData({ page: 1 })
      await this.loadCheckins()
    } finally {
      wx.hideLoading()
    }
  },

  onTapCheckin(e) {
    const pointId = e.currentTarget.dataset.pointId
    wx.navigateTo({
      url: `/pages/checkin-detail/checkin-detail?id=${pointId}`
    })
  }
}, { refreshOnTop: true })))
