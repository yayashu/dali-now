# 配置说明

本项目的敏感配置全部通过环境变量或前端占位配置注入，仓库中不含任何真实密钥。

## 服务端（services/server）

复制模板后填写 `.env`：

```bash
cd services/server
cp .env.example .env
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | MySQL 地址 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | 数据库账号 |
| `DB_PASSWORD` | 空 | 数据库密码，`.env` 中必填 |
| `DB_NAME` | `dali_now` | 库名 |
| `SERVER_PORT` | `3000` | Node.js 监听端口 |
| `WECHAT_APPID` | 空 | 小程序 AppID（换取 openid 用） |
| `WECHAT_SECRET` | 空 | 小程序 AppSecret |
| `ADMIN_USERNAME` | `admin` | 管理后台账号（Flask） |
| `ADMIN_PASSWORD` | 空 | 管理后台密码 |
| `ADMIN_SECRET` | 空 | 管理后台 Token 签名密钥 |
| `API_SECRET` | 空 | 公开 API 签名密钥，须与小程序端一致 |
| `RATE_LIMIT_GENERAL` | `100 per minute` | 全局 IP 频率限制 |
| `RATE_LIMIT_SEARCH` | `30 per minute` | 搜索接口频率限制 |
| `UPLOAD_DIR` | `~/dali_uploads` | 用户上传图片落盘目录 |

两份后端实现读取同一份配置：`services/server/config.js`（Node.js，`process.env`）与 `services/server/config.py`（Python，`os.environ`）。部署时由 `deploy/deploy.sh` 或 PM2 注入。

## 前端

| 端 | 文件 | 需要配置 |
|---|---|---|
| 微信小程序 | `apps/miniprogram/utils/config.js` | `SERVER_HOST`、`SERVER_PORT`、`API_SECRET` |
| 管理后台 | `apps/admin-panel/vite.config.js` | 开发代理 `target`（默认 `http://localhost:5000`，仅 dev 生效） |
| 管理后台 | `apps/admin-panel/.env` | `VITE_BAIDU_MAP_AK`（地图选点用，见下节） |

管理后台生产环境由 Nginx 反向代理 `/api/admin/*` 到 Flask，前端代码中只使用相对路径 `/api/admin`，无需配置后端地址。

## 第三方服务凭证

| 服务 | 用途 | 位置 | 说明 |
|---|---|---|---|
| 百度地图 JS API | 管理后台景点/打卡点选点 | `apps/admin-panel/.env` 的 `VITE_BAIDU_MAP_AK` | 复制 `.env.example` 后填写自己的 AK，并在百度控制台为该 AK 配置 Referer 白名单；未配置时后台其余功能正常，仅地图选点不可用 |
| 微信小程序 | 登录换 openid、发布 | 服务端环境变量 | `WECHAT_APPID` / `WECHAT_SECRET` |
| 微信支付 | 付费活动（当前版本未实现） | — | 后续接入时，商户密钥只能放服务端环境变量，不可出现在小程序端 |

> 前端页面里的地图 AK 属于「公开但可控」的凭证：它会随页面下发，无法隐藏，必须靠控制台白名单限制来源。

## 一致性与安全约定

- `API_SECRET` 必须两端一致：服务端 `.env` 与 `apps/miniprogram/utils/config.js`
- 小程序使用 HTTPS，域名需在微信公众平台配置为合法域名
- `.env` 已被 `.gitignore` 忽略，**不要**把真实密钥写入任何受版本管理的文件
- 生产部署后立即修改默认管理员账号与数据库密码，见 [SECURITY.md](../SECURITY.md) 的部署清单
