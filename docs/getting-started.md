# 本地开发指南

## 环境要求

| 依赖 | 版本 |
|---|---|
| Node.js | >= 18 |
| Python | >= 3.9 |
| MySQL / MariaDB | >= 8.0（utf8mb4） |
| 微信开发者工具 | 最新稳定版（仅小程序需要） |

## 1. 初始化数据库

```bash
mysql -u root -p -e "CREATE DATABASE dali_now DEFAULT CHARSET utf8mb4"

cd services/server
npm install
cp .env.example .env            # 编辑：DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 等
npm run init-db                 # 建表 + 敏感词库初始化
# 可选：导入种子数据
python scripts/import_seed.py
```

表结构与迁移脚本说明见 [database.md](./database.md)。

## 2. 启动服务端

```bash
cd services/server

# Node.js 公开 API（:3000）
npm start

# Python 管理后台 API（:5000，另开终端）
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

验证：

```bash
curl http://localhost:3000/api/health
curl http://localhost:5000/api/health
```

## 3. 启动管理后台

```bash
cd apps/admin-panel
npm install
npm run dev        # http://localhost:5173（/api 代理到 localhost:5000）
```

默认管理员账号由 `services/server/.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 决定。

## 4. 小程序

1. 用微信开发者工具导入 `apps/miniprogram`
2. 在 `project.config.json` 中填入自己的小程序 AppID
3. 修改 `utils/config.js`：

```js
const SERVER_HOST = 'localhost'        // 或你的域名
const SERVER_PORT = 3000
const API_SECRET = '与 services/server/.env 的 API_SECRET 一致'
```

> 开发阶段如使用 `http://localhost`，需在开发者工具中关闭“校验合法域名”。

## 常见问题

| 现象 | 原因与处理 |
|---|---|
| 接口返回签名错误 | 前端 `API_SECRET` 与服务端环境变量不一致，或本机时间偏差超过 ±5 分钟 |
| 列表数据为空 | 数据库未导入种子数据，或 `status` 过滤条件不匹配 |
| 图片 404 | `UPLOAD_DIR` 目录不存在，或 Nginx/Express 静态路径未指向该目录 |
| 管理后台 401 | Token 过期（24h），重新登录 |
| 端口占用 | 修改 `.env` 的 `SERVER_PORT`，并同步前端代理与 Nginx 配置 |

## 代码约定

- 列表接口统一返回 `{ list, total, page, size }`，入参兼容 `page/size` 与 `limit/offset`
- 服务端两侧（Node.js / Flask）业务行为保持一致
- 任何密钥都不得硬编码，统一走环境变量或前端占位配置
