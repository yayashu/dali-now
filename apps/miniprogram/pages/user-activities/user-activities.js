const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    activeTab: 'booked',
    bookedList: [],
    allBooked: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,
    loaded: false
  },

  async onLoad() {
    await this.loadBookings()
  },

  onShow() {
    if (this.data.loaded) {
      this.loadBookings()
    }
  },

  async loadBookings() {
    this.setData({ loading: true })

    try {
      const user = db.getCurrentUser()
      if (!user) {
        this.setData({ bookedList: [], loading: false, loaded: true })
        return
      }

      // 从用户预约表获取预约记录
      const bookings = db.table(db.TABLES.USER_BOOKINGS)
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
        .get()

      // 关联活动详情
      const enrichedList = bookings.map(booking => {
        const activity = db.table(db.TABLES.ACTIVITIES)
          .where('id', booking.activity_id)
          .first()

        return {
          ...booking,
          activityName: activity ? activity.name : '未知活动',
          activityCover: activity ? db.toAbsoluteUrl(activity.cover || activity.image_url || activity.images?.[0]) : '',
          activityDate: activity ? activity.date : '',
          activityAddress: activity ? activity.address : '',
          bookingDate: (booking.created_at || '').split(' ')[0],
          statusText: booking.status === 'confirmed' ? '已确认' : booking.status === 'completed' ? '已完成' : '待确认'
        }
      })

      // 分页切片
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayList = enrichedList.slice(0, page * pageSize)

      this.setData({
        allBooked: enrichedList,
        bookedList: displayList,
        hasMore: displayList.length < enrichedList.length,
        loading: false,
        loaded: true
      })
    } catch (e) {
      this.setData({ bookedList: [], allBooked: [], loading: false, loaded: true })
    }
  },

  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, allBooked } = this.data
    const newPage = page + 1
    const displayList = allBooked.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      bookedList: displayList,
      hasMore: displayList.length < allBooked.length
    })
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      this.setData({ page: 1 })
      await this.loadBookings()
    } finally {
      wx.hideLoading()
    }
  },

  onTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  onTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${id}` })
  }
}, { refreshOnTop: true })))
