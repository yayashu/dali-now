# 服务端（services/server）

Node.js Express + Python Flask 双进程，共享 MySQL 数据库。

## 目录

| 路径 | 说明 |
|---|---|
| `app.js` | Node.js 入口：中间件装配、路由挂载、静态服务、迁移检测 |
| `app.py` | Flask 入口：数据库连接、通用响应、Blueprint 注册 |
| `admin_api.py` | 管理后台 API（`/api/admin/*`） |
| `config.js` / `config.py` | 双侧配置，敏感项读环境变量 |
| `db.js` | mysql2 连接池与 `query` / `execute` 封装 |
| `utils.js` | Node 侧工具（分页、统一响应、URL 处理） |
| `image_utils.py` | 图片压缩、Base64 处理 |
| `routes/` | 公开 API（activities/checkin/community/districts/live/locallife/photos/scenic-spots/search/sensitive/upload/user/config） |
| `middleware/` | `signature.js` 签名校验、`auth.js` 登录态、`sensitive-filter.js` 敏感词 |
| `sql/` | `schema_mysql.sql` 与迁移脚本 |
| `scripts/` | 初始化、迁移、种子数据脚本 |
| `images/` | 种子图片（活动/打卡/首页） |
| `deploy/` | `nginx/dali-now.conf`、`deploy.sh`、`ecosystem.config.js`、`windows/*.bat` |

## 启动

```bash
cd services/server
npm install
cp .env.example .env     # 编辑数据库等配置

npm start                # Node.js 公开 API  :3000
pip install -r requirements.txt
python app.py            # Flask 管理后台 API :5000
```

## 环境变量

完整清单与默认值见 [../configuration.md](../configuration.md)，模板见 [`.env.example`](../../services/server/.env.example)：

| 变量 | 说明 |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | 数据库连接 |
| `SERVER_PORT` | Node.js 端口（默认 3000；Flask 由部署方式决定 5000） |
| `WECHAT_APPID` / `WECHAT_SECRET` | 微信小程序凭据（登录换 openid） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_SECRET` | 管理后台账号与 Token 密钥 |
| `API_SECRET` | 请求签名密钥，必须与各前端一致 |
| `RATE_LIMIT_GENERAL` / `RATE_LIMIT_SEARCH` | 频率限制 |
| `UPLOAD_DIR` | 图片落盘目录 |

## 常用脚本

| 脚本 | 用途 |
|---|---|
| `scripts/init-db.js` | 建库建表（`npm run init-db`） |
| `scripts/init-sensitive-words.js` | 初始化敏感词库（建表 + 灌词） |
| `scripts/import_seed.py` | 导入演示种子数据（活动、打卡、社区、本地生活、首页照片） |
| `scripts/init_mysql.py` | 纯 Python 方式建表，读取 `sql/schema_mysql.sql` |
| `scripts/gen_placeholders.py` | 按数据库中 `/images/` 路径补齐占位图 |
| `scripts/migrate_*.py` / `scripts/migrate_*.sql` | 一次性数据迁移，按需执行 |
| `scripts/test_publish.py` | 发布接口联调脚本，需先配置管理后台凭据 |

## 重要说明

- **不提交 `.env`**：仓库只保留 `.env.example`
- **`API_SECRET` 两端一致**：服务端 + 小程序
- **分页**：Node 用 `utils.js` 的 `getPagination(req)` / `paginatedData()`，Python 用 `get_pagination()`

## 部署

见 [../deployment/DEPLOY.md](../deployment/DEPLOY.md)。
