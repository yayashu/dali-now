# 技术架构

## 总体结构

仓库按「多端前端 + 单服务端」组织：两个客户端共用一套 API，服务端内部为 Node.js 与 Flask 双进程、共享一个 MySQL 库。

```text
┌──────────────────────────────────────────────────────────────┐
│  客户端                                                       │
│  apps/miniprogram          apps/admin-panel                    │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Nginx (:443)  services/server/deploy/nginx/dali-now.conf     │
│  ├─ /api/           → 127.0.0.1:3000 (Node.js 公开 API)       │
│  ├─ /api/admin/*    → 127.0.0.1:5000 (Flask 管理后台 API)     │
│  ├─ /api/upload/*   → 127.0.0.1:5000                          │
│  ├─ /admin/*        → apps/admin-panel 构建产物（静态）        │
│  ├─ /uploads/       → 用户上传图片目录                         │
│  └─ /images/        → services/server/images（种子图片）       │
└───────────────┬──────────────────────────────────────────────┘
                │ mysql2 / pymysql
                ▼
┌──────────────────────────────────────────────────────────────┐
│  MySQL / MariaDB  dali_now（utf8mb4，23 张表）                 │
└──────────────────────────────────────────────────────────────┘
```

## 服务端职责划分

| 进程 | 目录/入口 | 端口 | 职责 |
|---|---|---|---|
| Node.js Express | `services/server/app.js` + `routes/` | 3000 | 面向小程序的公开 API；签名校验、频率限制、静态图片、敏感词过滤 |
| Python Flask | `services/server/app.py` + `admin_api.py` | 5000 | 管理后台 API（`/api/admin/*`）：认证、全模块 CRUD、审核、Excel 导入导出、仪表盘、图片处理 |

## 请求链路

### 公开 API（Node.js）

```text
Nginx(443) → app.js
  ├─ signatureAuth            GET 请求 HMAC-SHA256 校验（±5 分钟窗口）
  ├─ 频率限制                  全局 100 次/分钟/IP；搜索 30 次/分钟/IP
  ├─ routes/*                 13 个业务模块
  │    ├─ middleware/auth.js            登录态校验
  │    └─ middleware/sensitive-filter.js 写入内容敏感词过滤
  └─ db.js → MySQL            分页统一 getPagination() / paginatedData()
```

### 管理后台（Flask）

```text
Nginx(443) → app.py
  ├─ /api/admin/login         独立限流（Nginx 5 次/分钟）
  ├─ X-Admin-Token 校验       HMAC 签名 Token，24 小时有效，无共享状态
  └─ admin_api.py Blueprint   全模块 CRUD / 审核 / 导入导出 / 统计
```

## 客户端与 API 的对应关系

| 客户端 | 主要调用 | 依赖接口 |
|---|---|---|
| 小程序 | `/api/activities`、`/api/live`、`/api/checkin`、`/api/user` | 公开 API + 登录态 |
| 管理后台 | `/api/admin/*`、`/api/upload/*` | 管理 Token |

## 关键约定

| 约定 | 说明 |
|---|---|
| 分页格式 | 返回 `{ list, total, page, size }`；入参兼容 `page/size` 与 `limit/offset` |
| 请求签名 | `SHA256(timestamp|nonce|GET|path|API_SECRET)`，前后端密钥必须一致 |
| 双端一致性 | 同一业务在 Node.js 与 Flask 两侧实现时行为保持一致 |
| 配置注入 | 服务端敏感配置走环境变量；前端走 `utils/config.js` 占位配置 |
| 图片 | 上传落盘 `UPLOAD_DIR`（默认 `~/dali_uploads`），按 cover/gallery/thumb 三档压缩 |
| 静态资源 | 管理后台构建产物部署到 Nginx `/admin/`；用户图片与种子图片分别由 `/uploads/`、`/images/` 提供 |

## 目录职责

```text
services/server/
├── app.js / app.py          双后端入口
├── admin_api.py             管理后台 Blueprint
├── config.py / config.js    双侧全局配置（敏感项取环境变量）
├── db.js                    mysql2 连接池封装
├── utils.js                 分页/响应/URL 工具（Node）
├── image_utils.py           图片压缩与 Base64（Python）
├── routes/                  公开 API 路由（13 模块）
├── middleware/              signature / auth / sensitive-filter
├── sql/                     DDL 与迁移
├── scripts/                 初始化、迁移、种子脚本
├── images/                  种子图片
└── deploy/                  nginx/、windows/、deploy.sh、ecosystem.config.js

apps/
├── miniprogram/             原生小程序
└── admin-panel/             Vue 3 + Element Plus
```

## 进程管理

生产环境使用 PM2（`services/server/deploy/ecosystem.config.js`）：

- `dali-api`：Node.js，内存超 500M 重启
- `dali-admin`：Flask，内存超 300M 重启

Windows 本地可用 `services/server/deploy/windows/start_prod.bat`。
