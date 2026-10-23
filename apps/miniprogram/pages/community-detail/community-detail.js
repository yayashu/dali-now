const db = require('../../utils/db.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    post: {}
  },

  async onLoad(options) {
    const id = options.id || 'comm_001'
    let post = db.getById(db.TABLES.COMMUNITY_POSTS, id)
    if (!post) {
      post = db.table(db.TABLES.COMMUNITY_POSTS).first()
    }
    // 获取标签
    post.tags = (await db.table(db.TABLES.COMMUNITY_TAGS)
      .where('post_id', post.id).getAsync()).map(t => t.tag)
    // 兼容旧字段名
    post.viewCount = post.view_count
    post.likeCount = post.like_count
    post.commentCount = post.comment_count
    this.setData({ post })
  },

  onBack() {
    if (getCurrentPages().length === 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack()
    }
  }
}))
