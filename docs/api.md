# API 接口概览

统一约定见文末；完整参数与实现请阅读对应源码文件。

## 公开 API（Node.js，前缀 `/api`，端口 3000）

### 通用

| 方法 | 路径 | 说明 | 源码 |
|---|---|---|---|
| GET | `/api/health` | 健康检查 | `app.js` |
| GET | `/api/districts` | 区县列表 | `routes/districts.js` |
| GET | `/api/config/:key` | 读取应用配置 | `routes/config.js` |
| PUT | `/api/config/:key` | 写入应用配置 | `routes/config.js` |

### 活动 activities.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/activities` | 活动列表（分页） |
| GET | `/api/activities/:id` | 活动详情 |
| GET | `/api/activities/search/:keyword` | 活动搜索 |
| POST | `/api/activities/submit` | 用户投稿活动 |

### 景点 scenic-spots.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/scenic-spots` | 景点列表 |
| GET | `/api/scenic-spots/:id` | 景点详情 |

### 打卡 checkin.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/checkin/points` | 打卡点列表 |
| GET | `/api/checkin/points/:id` | 打卡点详情 |
| POST | `/api/checkin/points/submit` | 投稿新打卡点 |
| POST | `/api/checkin/checkin` | 提交打卡（含敏感词过滤） |

### 现场动态 live.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/live/posts` | 现场动态列表 |
| GET | `/api/live/posts/:id` | 动态详情 |
| POST | `/api/live/posts` | 发布动态（登录 + 敏感词过滤） |
| PUT | `/api/live/posts/:id/hide` | 隐藏动态 |
| DELETE | `/api/live/posts/:id` | 删除动态 |
| POST | `/api/live/posts/:id/like` | 点赞 |

### 社区 community.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/community/posts` | 社区帖子列表 |
| GET | `/api/community/posts/:id` | 帖子详情 |

### 图片 photos.js / upload.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/photos/checkin` | 打卡照片 |
| GET | `/api/photos/homepage` | 首页照片 |
| POST | `/api/upload/image_base64` | Base64 图片上传（登录） |

### 本地生活 locallife.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/locallife/categories` | 分类列表 |
| GET | `/api/locallife/items` | 本地生活条目 |

### 用户 user.js

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/user/login` | 微信登录 |
| GET | `/api/user/:id` | 用户信息 |
| PUT | `/api/user/:id` | 更新用户信息（登录） |
| GET | `/api/user/:id/status` | 用户状态 |
| GET | `/api/user/:id/stats` | 用户统计 |
| GET/POST | `/api/user/:id/bookings` | 活动预约 查询/创建 |
| GET/POST/DELETE | `/api/user/:id/favorites` | 收藏 查询/添加/取消 |
| GET/POST | `/api/user/:id/checkins` | 打卡记录 查询/提交 |
| POST/DELETE | `/api/user/:id/likes` | 点赞/取消 |

### 搜索 search.js

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/search/history` | 记录搜索历史（敏感词过滤） |
| GET/DELETE | `/api/search/history/:user_id` | 搜索历史 查询/清空 |
| GET | `/api/search/activities` | 搜索活动 |

### 敏感词 sensitive.js

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/sensitive/check` | 检测文本 |
| GET/POST | `/api/sensitive/words` | 词库 查询/新增 |
| DELETE | `/api/sensitive/words/:id` | 删除词条 |
| POST | `/api/sensitive/reload` | 重载词库 |

## 管理后台 API（Flask，前缀 `/api/admin`，端口 5000）

认证方式：`POST /api/admin/login` 获取 Token，后续请求携带 `X-Admin-Token` 头（24 小时有效）。

| 模块 | 主要接口 | 源码位置（admin_api.py） |
|---|---|---|
| 认证 | `POST /login`、`POST /logout`、`GET /check` | `@admin_bp.route('/login')` 等 |
| 仪表盘 | `GET /dashboard` | 数据统计概览 |
| 活动 | `/activities` CRUD、`/publish`、`/approve`、`/template`、`/import`（Excel 批量） | |
| 活动类型 | `/activity-types` CRUD | |
| 景点 | `/scenic-spots` CRUD、`/search`、`/template`、`/import` | |
| 打卡点 | `/checkin-points` CRUD、`/publish`、`/approve`、`/template`、`/import` | |
| 现场动态 | `/live-posts` 列表、删除 | |
| 社区帖子 | `/community-posts` CRUD | |
| 首页照片 | `/homepage-photos` CRUD | |
| 本地生活 | `/locallife-items` CRUD | |
| 区县 | `/districts` CRUD | |
| 用户 | `/users` 列表、删除、`/ban`、`/unban` | |
| 预约 | `/bookings` 列表 | |
| 配置 | `/config` 读写 | |

## 通用约定

### 响应格式

```json
{ "code": 0, "msg": "ok", "data": { } }
```

- `code = 0` 成功；非 0 为业务错误码，`msg` 为提示信息

### 分页约定

- 入参：`page` + `size`（或兼容 `limit` + `offset`）
- 返回：`{ "list": [...], "total": 123, "page": 1, "size": 20 }`

### 请求签名（公开 API GET）

GET 请求需携带签名头，算法：

```
原文 = `${timestamp}|${nonce}|GET|${path}|${API_SECRET}`
签名 = SHA256(原文) → 64 位十六进制小写
```

时间窗口 ±5 分钟（详见 `middleware/signature.js` 与 `docs/release/UPGRADE_v2.1.0_API_Security.md`）。

### 管理后台认证

登录后所有请求携带：

```
X-Admin-Token: <timestamp>:<hmac_signature>
```
