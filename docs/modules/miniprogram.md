# 微信小程序（apps/miniprogram）

原生小程序项目，共 29 个页面，覆盖全部业务模块。

## 目录结构

```text
apps/miniprogram/
├── app.js / app.json / app.wxss
├── project.config.json          # AppID、编译设置
├── sitemap.json
├── pages/                       # 页面（每页 js/json/wxml/wxss）
├── utils/
│   ├── config.js                # 服务地址、API_SECRET、请求封装与签名
│   ├── db.js                    # 数据访问封装
│   ├── crypto.js                # SHA256（签名用）
│   ├── util.js / privacy.js     # 工具与隐私文案
│   └── ...
├── images/                      # 本地图片资源
└── styles/                      # 公共样式
```

## 导入与配置

1. 微信开发者工具 → 导入项目 → 选择 `apps/miniprogram`
2. 修改 `project.config.json` 的 `appid` 为自己的小程序 AppID
3. 修改 `utils/config.js`：

```js
const SERVER_HOST = 'your-domain.com'   // 或 localhost
const SERVER_PORT = 443
const API_SECRET = '与 services/server/.env 的 API_SECRET 一致'
```

4. 本地调试 `http://localhost` 时，在开发者工具「详情 → 本地设置」中关闭“校验合法域名”

## 请求签名

`utils/config.js` 中的 `apiRequest()` 会自动为 GET 请求附加 `X-Timestamp` / `X-Nonce` / `X-Sign` 头，算法与服务端 `middleware/signature.js` 保持一致：

```text
sign = SHA256(timestamp|nonce|GET|path|API_SECRET)
```
