# 微信小程序（apps/miniprogram）

「大理此刻」面向游客的微信小程序客户端，原生小程序实现（29 个页面），通过 HTTPS 调用 `services/server` 提供的公开 API。

## 界面预览

<table>
  <tr>
    <td align="center"><img src="../../docs/assets/screenshots/miniprogram/01-index.jpg" width="180" alt="今日活动"><br><sub>今日活动</sub></td>
    <td align="center"><img src="../../docs/assets/screenshots/miniprogram/02-activity-detail.jpg" width="180" alt="活动详情"><br><sub>活动详情</sub></td>
    <td align="center"><img src="../../docs/assets/screenshots/miniprogram/04-checkin.jpg" width="180" alt="官方打卡"><br><sub>官方打卡</sub></td>
    <td align="center"><img src="../../docs/assets/screenshots/miniprogram/07-live.jpg" width="180" alt="我在现场"><br><sub>我在现场</sub></td>
  </tr>
</table>

## 功能模块

| 模块 | 说明 | 页面 |
|---|---|---|
| 今日活动 | 活动列表、筛选、搜索、详情、预约报名、活动投稿 | `pages/index`、`pages/activity-detail`、`pages/booking`、`pages/booking-confirm`、`pages/search`、`pages/submit-activity` |
| 官方打卡 | 打卡点位、机位教程、打卡照片、提交打卡 | `pages/checkin`、`pages/checkin-detail`、`pages/checkin-photos`、`pages/submit-checkin` |
| 我在现场 | 现场动态流、现场发文、活动广场 | `pages/live`、`pages/live-post`、`pages/live-square` |
| 文旅服务 | 景点速查与详情、本地生活、便民服务 | `pages/service`、`pages/scenic-detail` |
| 社区内容 | UGC 攻略列表与详情 | `pages/community`、`pages/community-detail` |
| 用户中心 | 资料编辑、我的活动/打卡/发文/收藏、注册、关于、分享海报 | `pages/user`、`pages/user-profile`、`pages/user-activities`、`pages/user-checkins`、`pages/user-posts`、`pages/user-favorites`、`pages/register`、`pages/about`、`pages/share-poster` |
| 景点管理（内置） | 登录后维护景点数据 | `pages/admin/login`、`pages/admin/scenic-spots/list`、`pages/admin/scenic-spots/edit` |

TabBar 5 个入口：今日活动 / 官方打卡 / 我在现场 / 服务 / 我的。

## 目录结构

```text
apps/miniprogram/
├── app.js / app.json / app.wxss
├── project.config.json          # AppID、编译设置
├── sitemap.json
├── pages/                       # 页面（每页 js/json/wxml/wxss）
│   └── admin/                   # 内置景点管理
├── utils/
│   ├── config.js                # 服务地址、API_SECRET、请求封装
│   ├── db.js                    # 数据访问封装
│   ├── crypto.js                # SHA256（签名用）
│   ├── admin.js                 # 管理接口调用
│   ├── image-compress.js        # 上传前图片压缩
│   ├── sensitive-filter.js      # 前端敏感词预检
│   ├── svg-icons.js             # 图标 SVG 生成
│   ├── privacy.js               # 隐私协议与小程序介绍文案
│   └── util.js                  # 通用工具
├── images/                      # 本地图标与模板图
└── styles/common.wxss           # 公共样式变量与工具类
```

## 导入与配置

1. 微信开发者工具 → 导入项目 → 选择 `apps/miniprogram`
2. 修改 `project.config.json` 的 `appid` 为自己的小程序 AppID
3. 修改 `utils/config.js`：

```js
const SERVER_HOST = 'your-domain.com'   // 部署后的域名
const SERVER_PORT = 443
const API_SECRET = '与 services/server/.env 的 API_SECRET 一致'
```

4. 本地调试 `http://localhost` 时，在开发者工具「详情 → 本地设置」中关闭“校验合法域名”

## 请求签名

`utils/config.js` 的 `apiRequest()` 会为 GET 请求附加 `X-Timestamp` / `X-Nonce` / `X-Sign`，算法与服务端 `services/server/middleware/signature.js` 保持一致：

```text
sign = SHA256(timestamp|nonce|GET|path|API_SECRET)
```

## 发布

1. 微信公众平台 → 开发设置 → 服务器域名，配置 `request` / `uploadFile` / `downloadFile` 合法域名
2. 开发者工具点击「上传」，填写版本号与备注
3. 公众平台「版本管理」→ 提交审核 → 发布

## 研发边界

- 不含会员付费、积分体系、达人等级权益
- 不含住宿/商铺的完整交易支付链路
- 不含 AI 智能规划、智能滤镜、精细用户画像
- 不含优惠券、秒杀、拼团等营销玩法
