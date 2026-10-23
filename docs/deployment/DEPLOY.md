# 大理此刻 (DaLiNow) - 部署文档

> 微信小程序「大理此刻」全栈部署指南  
> 最后更新：2026-06-13

---

## 目录

- [一、项目架构概览](#一项目架构概览)
- [二、部署环境要求](#二部署环境要求)
- [三、数据库部署](#三数据库部署)
- [四、后端服务部署](#四后端服务部署)
  - [4.1 Node.js Express 部署](#41-nodejs-express-部署)
  - [4.2 Python Flask 部署](#42-python-flask-部署)
  - [4.3 使用 PM2 守护进程（推荐）](#43-使用-pm2-守护进程推荐)
- [五、Nginx 反向代理配置](#五nginx-反向代理配置)
- [六、微信小程序前端部署](#六微信小程序前端部署)
- [七、安全加固清单](#七安全加固清单)
- [八、日常运维](#八日常运维)
- [九、快速部署脚本](#九快速部署脚本)
- [十、管理后台前端部署](#十管理后台前端部署)

---

## 一、项目架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      用户 (微信小程序)                          │
│         用户 (浏览器 → 管理后台 /admin/)                         │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS (wss://)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      Nginx (反向代理)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ /api/*   │  │/uploads/*│  │ /images/*│  │ /admin/*     │ │
│  │(API接口) │  │(用户上传)│  │(系统图片)│  │(管理后台SPA) │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
└──────┼──────────────┼─────────────┼───────────────┼─────────┘
       │              │             │               │
       ▼              ▼             ▼               ▼
┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│Node.js    │  │ 静态文件  │  │ 静态文件  │  │ 静态文件     │
│:3000      │  │ /data/    │  │ /images/ │  │ /data/www/   │
│(Express)  │  │ uploads/  │  │          │  │ admin/       │
└─────┬─────┘  └──────────┘  └──────────┘  └──────────────┘
      │                                         │
      │                              调用 /api/admin/*
      │                                         │
      │              ┌──────────────────────────┘
      │              ▼
      │    ┌──────────────────┐
      │    │  Python Flask    │
      │    │  :5000 (管理API) │
      │    └────────┬─────────┘
      │             │
      └──────┬──────┘
             ▼
  ┌──────────────────┐
  │   MySQL :3306    │
  │   数据库 dali_now │
  └──────────────────┘
```

**双后端说明**：
| 版本 | 框架 | 默认端口 | 入口文件 | 启动命令 |
|------|------|---------|---------|---------|
| Node.js | Express + mysql2 | 3000 | `app.js` | `npm start` |
| Python | Flask + pymysql | 5000 | `app.py` | `python app.py` |

> 两个后端共享同一个 MySQL 数据库。建议生产环境**选其一**部署即可（推荐 Node.js 版，性能更好）。

---

## 二、部署环境要求

| 组件 | 版本要求 | 说明 |
|------|---------|------|
| **操作系统** | Linux (CentOS 7+ / Ubuntu 18+) 或 Windows Server | 推荐 Linux |
| **Node.js** | ≥ 18.0 | Express 服务端 |
| **Python** | ≥ 3.9 | Flask 管理后台 |
| **MySQL** | ≥ 8.0 | 主数据库 |
| **Nginx** | ≥ 1.18 | 反向代理 + 静态文件 |
| **Git** | ≥ 2.0 | 代码部署 |

### 端口规划

| 端口 | 用途 | 外部暴露 |
|------|------|---------|
| 80/443 | Nginx HTTP/HTTPS（小程序公开 API） | ✅ 是 |
| 8080 | Nginx HTTP（管理后台前端 + API） | ✅ 是（如对外） |
| 3000 | Node.js API 服务 | ❌ 否（仅 localhost） |
| 5000 | Python Flask 管理后台 API | ❌ 否（仅 localhost） |
| 3306 | MySQL 数据库 | ❌ 否（仅 localhost，或限定 IP） |

---

## 三、数据库部署

### 3.1 创建数据库

连接 MySQL 并执行建表脚本：

```bash
# 连接 MySQL
mysql -u root -p

# 执行建表 + 种子数据
source /path/to/dali-now/services/server/sql/schema_mysql.sql;
```

### 3.2 执行迁移脚本（按需）

```sql
-- live_posts 新增打卡点关联字段
source /path/to/dali-now/services/server/sql/migrate_live_posts_points.sql;

-- 活动类型字典表
source /path/to/dali-now/services/server/sql/migrate_activity_types.sql;

-- 景点模块（景点表 + 打卡点关联字段）
source /path/to/dali-now/services/server/scripts/migrate_scenic_spots.sql;

-- 用户状态字段
source /path/to/dali-now/services/server/scripts/migrate_user_status.sql;
```

### 3.3 数据库安全

```sql
-- 创建专用用户（不要用 root）
CREATE USER 'dali_app'@'localhost' IDENTIFIED BY '<your_db_password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON dali_now.* TO 'dali_app'@'localhost';
FLUSH PRIVILEGES;

-- 初始化敏感词库（可选）
-- 通过 API: POST /api/sensitive/reload
```

### 3.4 数据库表清单

| 表名 | 说明 |
|------|------|
| `districts` | 区域/区县 |
| `activities` | 活动 |
| `activity_tags` | 活动标签 |
| `activity_images` | 活动图片 |
| `activity_types` | 活动类型 |
| `checkin_points` | 打卡点 |
| `checkin_photos` | 打卡照片 |
| `live_posts` | 现场发文 |
| `live_post_images` | 发文图片 |
| `community_posts` | 社区攻略 |
| `community_tags` | 社区标签 |
| `homepage_photos` | 首页照片墙 |
| `local_life_categories` | 本地生活分类 |
| `local_life_items` | 本地生活项目 |
| `users` | 用户 |
| `user_bookings` | 用户预约 |
| `user_checkins` | 用户打卡记录 |
| `user_favorites` | 用户收藏 |
| `user_likes` | 用户点赞 |
| `search_history` | 搜索历史 |
| `app_config` | 应用配置 |
| `scenic_spots` | 景点 |
| `sensitive_words` | 敏感词库 |

---

## 四、后端服务部署

### 4.1 Node.js Express 部署

```bash
# 1. 克隆/上传代码到服务器
cd /data
# 假设代码放在 /data/dali-now/services/server

# 2. 安装依赖
cd /data/dali-now/services/server
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env   # 修改数据库密码等敏感信息

# 4. 创建上传目录
mkdir -p /data/dali-now/uploads
mkdir -p /data/dali-now/services/server/images

# 5. 加载环境变量并启动
set -a; source .env; set +a
npm start
# 默认监听 0.0.0.0:3000

# 6. 验证
curl http://localhost:3000/api/health
# 预期返回: {"status":"ok","time":"..."}
```

### 4.2 Python Flask 部署

```bash
# 1. 安装 Python 依赖
cd /data/dali-now/services/server
pip install -r requirements.txt

# 2. 配置环境变量（同 Node.js）
set -a; source .env; set +a

# 3. 启动（Flask 开发模式，仅用于测试）
python app.py
# 默认监听 0.0.0.0:5000

# 4. 或使用 gunicorn（生产推荐）
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# 5. 验证
curl http://localhost:5000/api/health
```

### 4.3 使用 PM2 守护进程（推荐）

PM2 可以同时管理 Node.js 和 Python 进程，提供自动重启、日志管理等功能。

```bash
# 安装 PM2
npm install -g pm2

# ---- Node.js ----
pm2 start app.js --name dali-api --cwd /data/dali-now/services/server

# ---- Python (使用 gunicorn) ----
pm2 start "gunicorn -w 4 -b 0.0.0.0:5000 app:app" --name dali-admin --cwd /data/dali-now/services/server

# ---- 设置开机自启 ----
pm2 save
pm2 startup

# ---- 常用命令 ----
pm2 status              # 查看状态
pm2 logs dali-api       # 查看日志
pm2 restart dali-api    # 重启
pm2 stop dali-api       # 停止
pm2 reload dali-api     # 零停机重载
```

**PM2 配置文件 `ecosystem.config.js`**（放在 `deploy/` 目录）：

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'dali-api',
      script: 'app.js',
      cwd: '/data/dali-now/services/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3000
      },
      max_memory_restart: '500M',
      log_file: '/data/logs/dali-api.log',
      error_file: '/data/logs/dali-api-error.log'
    },
    {
      name: 'dali-admin',
      script: 'gunicorn',
      args: '-w 4 -b 0.0.0.0:5000 app:app',
      cwd: '/data/dali-now/services/server',
      interpreter: 'none',  // gunicorn is the entry itself
      env: {
        SERVER_PORT: 5000
      },
      log_file: '/data/logs/dali-admin.log',
      error_file: '/data/logs/dali-admin-error.log'
    }
  ]
};
```

---

## 五、Nginx 反向代理配置

生产环境必须通过 Nginx 反代，提供 HTTPS、静态文件缓存、负载均衡。

### 5.1 安装 Nginx

```bash
# CentOS
yum install -y nginx

# Ubuntu
apt install -y nginx
```

### 5.2 配置文件

项目提供了完整的 Nginx 配置模板 `services/server/deploy/nginx/dali-now.conf`，直接部署：

```bash
# 将配置文件复制到 Nginx 目录
cp services/server/deploy/nginx/dali-now.conf /etc/nginx/conf.d/dali-now.conf

# 编辑配置文件，替换域名为你的实际域名
vim /etc/nginx/conf.d/dali-now.conf
# 把所有 "your-domain.com" 替换为真实域名
```

**配置文件包含以下特性**：

| 特性 | 说明 |
|------|------|
| HTTP → HTTPS 自动跳转 | 80 端口全部 301 到 HTTPS |
| SSL 安全配置 | TLS 1.2/1.3，安全密码套件，HSTS 基础 |
| 管理后台前端 SPA | `/admin/` 支持 Vue Router history 模式 |
| 管理登录限流 | `/api/admin/login` 每分钟最多 5 次 |
| 顺序匹配路由 | 精确匹配优先于通配，管理 API 优先于公开 API |
| Gzip 压缩 | CSS/JS/JSON/SVG/字体等启用压缩 |
| 静态资源缓存 | JS/CSS 带 hash 缓存 1 年，图片 30 天，index.html 不缓存 |
| 安全头 | X-Frame-Options、X-Content-Type-Options 等 |
| 隐藏文件保护 | `/.` 禁止访问 |

完整配置内容见：[dali-now.conf](../../services/server/deploy/nginx/dali-now.conf)

### 5.3 启用 HTTPS（使用 Let's Encrypt）

```bash
# 安装 certbot
yum install -y certbot python3-certbot-nginx   # CentOS
# apt install -y certbot python3-certbot-nginx  # Ubuntu

# 自动获取证书并配置 HTTPS
certbot --nginx -d your-domain.com

# 设置自动续期
echo "0 3 * * * certbot renew --quiet" | crontab -
```

### 5.4 测试并启动

```bash
nginx -t                    # 测试配置
systemctl start nginx       # 启动
systemctl enable nginx      # 开机自启
systemctl reload nginx      # 重载配置
```

---

## 六、微信小程序前端部署

### 6.1 配置服务器地址

编辑 `apps/miniprogram/utils/config.js`，修改 `SERVER_HOST` 为服务器公网地址：

```javascript
// utils/config.js
const SERVER_HOST = 'your-domain.com'   // 生产环境域名
const SERVER_PORT = null                // HTTPS 默认 443，无需端口
const SERVER_ORIGIN = `https://${SERVER_HOST}`  // 使用 HTTPS
```

**注意**：微信小程序要求 API 必须使用 HTTPS，且域名需在小程序后台配置为可信域名。

### 6.2 微信公众平台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. **开发 → 开发管理 → 开发设置 → 服务器域名**
   - `request合法域名`：添加 `https://your-domain.com`
   - `uploadFile合法域名`：添加 `https://your-domain.com`
   - `downloadFile合法域名`：添加 `https://your-domain.com`
3. **业务域名**：添加 `https://your-domain.com`（如有 webview）

### 6.3 上传代码

1. 在微信开发者工具中打开 `apps/miniprogram` 项目
2. 点击工具栏 **上传** 按钮
3. 填写版本号和备注
4. 登录微信公众平台 → **管理 → 版本管理**
5. 选择上传的版本 → **提交审核** → 等待审核通过 → **发布**

---

## 七、安全加固清单

### 7.1 必须执行

| 项目 | 操作 | 优先级 |
|------|------|--------|
| 🔒 修改数据库密码 | 不要使用默认密码 `<your_db_password>`，改为强密码 | **紧急** |
| 🔒 修改管理后台密码 | 修改 `config.py` 中 `ADMIN_PASSWORD` / `ADMIN_SECRET` 或通过环境变量覆盖 | **紧急** |
| 🔒 修改微信密钥 | 确认 `WECHAT_APPID` 和 `WECHAT_SECRET` 为正式环境值 | **紧急** |
| 🔒 创建 `.env` 文件 | 所有敏感信息通过环境变量注入，不要硬编码 | **高** |
| 🔒 数据库访问限制 | MySQL 只允许应用服务器 IP 访问 | **高** |
| 🔒 HTTPS 强制 | 所有 API 走 HTTPS，Nginx 配置 301 跳转 | **高** |
| 🔒 防火墙规则 | 仅开放 80/443/8080 端口；3000/5000/3306 仅允许 localhost | **高** |

### 7.2 防火墙配置

```bash
# iptables 示例（仅开放必要端口）
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT  # 管理后台
iptables -A INPUT -p tcp --dport 22 -j ACCEPT    # SSH
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -P INPUT DROP

# 或使用 ufw (Ubuntu)
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw allow 22/tcp
ufw enable
```

### 7.3 数据库备份

```bash
# 创建备份目录
mkdir -p /data/backups

# 每日备份脚本 /data/scripts/backup-db.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u dali_app -p'password' --single-transaction dali_now \
  | gzip > /data/backups/dali_now_${DATE}.sql.gz

# 保留最近 30 天的备份
find /data/backups -name "*.gz" -mtime +30 -delete

# 添加到 crontab（每天凌晨 2 点）
# 0 2 * * * /data/scripts/backup-db.sh
```

---

## 八、日常运维

### 8.1 常用命令速查

```bash
# ---- 服务管理 ----
pm2 status                          # 查看所有进程
pm2 restart all                     # 重启所有服务
pm2 restart dali-api                # 重启 API 服务
pm2 logs dali-api --lines 100       # 查看最近 100 行日志
systemctl status nginx              # Nginx 状态

# ---- 日志查看 ----
tail -f /var/log/nginx/dali-access.log    # 实时访问日志
tail -f /data/logs/dali-api.log           # API 服务日志
journalctl -u nginx -f                     # Nginx 系统日志

# ---- 数据库 ----
mysql -u dali_app -p dali_now
SELECT COUNT(*) FROM users;               # 用户数
SELECT COUNT(*) FROM activities WHERE status='active';  # 活跃活动数
SHOW PROCESSLIST;                         # 查看当前连接

# ---- 磁盘空间 ----
du -sh /data/dali-now/uploads/            # 上传文件占用
df -h                                      # 磁盘使用情况
```

### 8.2 API 端点速查

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/activities` | GET | 活动列表 |
| `/api/activities/:id` | GET | 活动详情 |
| `/api/checkin/points` | GET | 打卡点列表 |
| `/api/checkin/points/:id` | GET | 打卡点详情 |
| `/api/live/posts` | GET | 现场动态列表 |
| `/api/live/posts` | POST | 发布现场动态 |
| `/api/community/posts` | GET | 社区攻略列表 |
| `/api/community/posts/:id` | GET | 社区攻略详情 |
| `/api/user/login` | POST | 用户登录 |
| `/api/user/:id/bookings` | POST | 预约活动 |
| `/api/user/:id/favorites` | POST | 添加收藏 |
| `/api/search/activities` | GET | 搜索活动 |
| `/api/upload/image_base64` | POST | 小程序图片上传 |
| `/api/admin/*` | * | 管理后台（Python Flask） |

### 8.3 监控指标

建议监控以下指标：
- 数据库连接数（`SHOW PROCESSLIST`）
- 上传文件磁盘空间
- API 响应时间（通过 Nginx access log 分析）
- PM2 进程内存占用（`pm2 monit`）

### 8.4 代码更新部署流程

日常修改代码后，按以下步骤推送到服务器：

```bash
# === 1. 从本地上传文件到服务器 ===
scp admin_api.py root@<服务器IP>:/data/dali-now/services/server/
scp app.py root@<服务器IP>:/data/dali-now/services/server/
scp routes/*.js root@<服务器IP>:/data/dali-now/services/server/routes/

# === 2. Node.js 服务更新（重启即可生效） ===
ssh root@<服务器IP> "pm2 restart dali-api"

# === 3. Python Flask 服务更新（需清缓存后重启） ===
ssh root@<服务器IP> "
  pm2 stop dali-admin && 
  rm -rf /data/dali-now/services/server/__pycache__ && 
  pm2 start dali-admin
"

# === 4. 验证 Python 代码更新是否生效（对比特征代码） ===
ssh root@<服务器IP> "grep '<关键字>' /data/dali-now/services/server/admin_api.py"
curl -s 'http://<服务器IP>:5000/api/admin/...' | grep '<关键字>'
```

### 8.5 Python Flask 代码更新不生效排查

当确认代码已上传、`pm2 restart` 已执行，但服务仍然运行旧代码时：

```bash
# 1. 确认服务器上的文件确实是新代码
ssh root@<服务器IP> "grep '<新代码才有的关键字>' /data/dali-now/services/server/admin_api.py"

# 2. 清除 Python 字节码缓存（这是最常见的原因！）
ssh root@<服务器IP> "rm -rf /data/dali-now/services/server/__pycache__"

# 3. 完整重启（先 stop 再 start，不要用 restart）
ssh root@<服务器IP> "pm2 stop dali-admin"
ssh root@<服务器IP> "rm -rf /data/dali-now/services/server/__pycache__"
ssh root@<服务器IP> "pm2 start dali-admin"

# 4. 验证接口是否使用新代码（用 curl 打接口看返回值）
curl -s -H 'Authorization: Bearer <token>' \
  'http://<服务器IP>:5000/api/admin/scenic-spots?page=1&size=1' | python -m json.tool

# 5. 查看 PM2 进程日志（确认启动正常）
ssh root@<服务器IP> "pm2 logs dali-admin --lines 20 --nostream"
```

> **重要**：Python Flask 使用 gunicorn 多进程模式，`pm2 restart` 可能让旧 `.pyc` 缓存继续生效。
> `pm2 stop` + 清 `__pycache__` + `pm2 start` 是最可靠的更新方式。

### 8.6 日常巡检命令

```bash
# 一键检查所有服务状态
ssh root@<服务器IP> "
echo '=== PM2 进程 ==='; pm2 status;
echo ''; echo '=== 磁盘空间 ==='; df -h /data;
echo ''; echo '=== 上传文件大小 ==='; du -sh /data/dali-now/uploads/;
echo ''; echo '=== Nginx 状态 ==='; systemctl is-active nginx;
echo ''; echo '=== 近期错误日志 ==='; pm2 logs --err --lines 5 --nostream
"

# 检查 API 健康
curl -s http://<服务器IP>:3000/api/health && echo ""
curl -s http://<服务器IP>:5000/api/health && echo ""

# 检查数据库连接数
ssh root@<服务器IP> "mysql -u dali_app -p'<password>' -e 'SHOW PROCESSLIST' dali_now"
```

---

## 九、快速部署脚本

### Linux 一键部署脚本

```bash
#!/bin/bash
# ============================================================
# 大理此刻 - 一键部署脚本 (Linux)
# 用法: chmod +x services/server/deploy/deploy.sh && sudo services/server/deploy/deploy.sh
# ============================================================

set -e

APP_DIR="/data/dali-now/services/server"
UPLOAD_DIR="/data/dali-now/uploads"
NODE_PORT=3000
PYTHON_PORT=5000

echo "===== 1. 安装系统依赖 ====="
yum install -y nodejs npm python3 python3-pip nginx mysql || \
  apt install -y nodejs npm python3 python3-pip nginx mysql-server

echo "===== 2. 安装 Node.js 依赖 ====="
cd $APP_DIR
npm install --production

echo "===== 3. 安装 Python 依赖 ====="
pip3 install -r requirements.txt

echo "===== 4. 配置环境变量 ====="
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  请编辑 $APP_DIR/.env 填入真实配置后重新运行！"
  echo "   vim $APP_DIR/.env"
  exit 0
fi

echo "===== 5. 创建目录 ====="
mkdir -p $UPLOAD_DIR

echo "===== 6. 安装 PM2 ====="
npm install -g pm2

echo "===== 7. 启动 Node.js API 服务 ====="
set -a; source .env; set +a
pm2 start app.js --name dali-api --cwd $APP_DIR

echo "===== 8. 启动 Python 管理后台 ====="
pm2 start "gunicorn -w 2 -b 0.0.0.0:$PYTHON_PORT app:app" \
  --name dali-admin --cwd $APP_DIR

echo "===== 10. 部署管理后台前端 ====="
ADMIN_DIR="/data/www/admin"
if [ -d "../admin-panel/dist" ]; then
  mkdir -p $ADMIN_DIR
  cp -r ../admin-panel/dist/* $ADMIN_DIR/
  chown -R nginx:nginx $ADMIN_DIR
  echo "   管理后台前端已部署到 $ADMIN_DIR"
else
  echo "⚠️  未找到 admin-panel/dist，跳过管理后台前端部署"
  echo "   请先在本地执行: cd ../admin-panel && npm run build"
fi

echo "===== 11. 设置 PM2 开机自启 ====="
pm2 save
pm2 startup

echo "===== 12. 验证服务 ====="
sleep 2
curl -s http://localhost:$NODE_PORT/api/health
echo ""
curl -s http://localhost:$PYTHON_PORT/api/health
echo ""

echo ""
echo "✅ 部署完成！"
echo "   Node.js API:  http://localhost:$NODE_PORT/api/health"
echo "   Python 管理:  http://localhost:$PYTHON_PORT/api/health"
echo ""
echo "   接下来请配置 Nginx 反向代理（参考 DEPLOY.md 第五章）"
echo "   管理后台前端: 配置 Nginx 后访问 http://your-domain.com:8080/admin/"
```

### 微信小程序上线前 Checklist

- [ ] 服务器域名已配置 HTTPS (Let's Encrypt 或商业证书)
- [ ] `utils/config.js` 中 `SERVER_HOST` 已改为正式域名
- [ ] `utils/config.js` 中 `SERVER_ORIGIN` 已改为 `https://`
- [ ] 微信公众平台 → 服务器域名已添加所有合法域名
- [ ] 小程序所有页面功能已验证通过
- [ ] 敏感词库已初始化 (`POST /api/sensitive/reload`)
- [ ] 数据库已完成备份
- [ ] 管理后台可正常登录和操作

---

## 十、管理后台前端部署

管理后台是一个独立的 Vue 3 单页应用（SPA），通过 API 调用 Flask 后端的 `/api/admin/*` 接口实现数据管理。

### 10.1 项目概览

| 项目 | 说明 |
|------|------|
| **代码位置** | `apps/admin-panel/`（与 `services/server/` 同级目录） |
| **技术栈** | Vue 3 + Vite 5 + Element Plus + Pinia + Vue Router + ECharts |
| **开发端口** | 5173（`npm run dev`） |
| **构建产物** | `admin-panel/dist/` |
| **API 代理** | 开发时 Vite proxy → `http://localhost:5000`（Flask 管理后台） |

### 10.2 依赖包清单

| 包名 | 版本 | 用途 |
|------|------|------|
| `vue` | ^3.4.0 | 前端框架 |
| `vue-router` | ^4.3.0 | 路由管理 |
| `pinia` | ^2.1.0 | 状态管理 |
| `axios` | ^1.7.0 | HTTP 请求库 |
| `element-plus` | ^2.7.0 | UI 组件库 |
| `@element-plus/icons-vue` | ^2.3.0 | 图标库 |
| `echarts` | ^5.5.0 | 图表库 |
| `vue-echarts` | ^6.7.0 | ECharts Vue 封装 |
| `vite` | ^5.4.0 | 构建工具 |
| `@vitejs/plugin-vue` | ^5.0.0 | Vite Vue 插件 |

### 10.3 本地构建

在本地开发机（Windows / macOS）执行：

```bash
# 1. 进入管理后台项目目录
cd admin-panel

# 2. 安装依赖（仅首次）
npm install

# 3. 构建生产版本
npm run build
```

构建完成后，产物在 `admin-panel/dist/` 目录下，包含：

```
dist/
├── index.html          # 入口 HTML
├── assets/             # 打包后的 JS/CSS/图片
│   ├── index-xxx.js
│   ├── index-xxx.css
│   └── ...
└── favicon.ico         # 网站图标（如有）
```

### 10.4 部署到服务器

#### 方式一：Nginx 直接托管（推荐）

将 `dist/` 上传到服务器的静态目录，由 Nginx 直接提供服务：

```bash
# 1. 在服务器上创建管理后台目录
mkdir -p /data/www/admin

# 2. 从本地上传 dist 文件到服务器
#    在本地执行：
scp -r admin-panel/dist/* root@<服务器IP>:/data/www/admin/

# 3. 设置目录权限
chown -R nginx:nginx /data/www/admin
chmod -R 755 /data/www/admin
```

**Nginx 配置**：在 `/etc/nginx/conf.d/dali-now.conf` 中添加：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # ... 其他已有配置 ...

    # ====== 管理后台前端（SPA） ======
    location /admin/ {
        alias /data/www/admin/;
        try_files $uri $uri/ /admin/index.html;
        index index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # ====== 管理后台 API（代理到 Flask） ======
    location /api/admin/ {
        proxy_pass http://dali_admin;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # ====== 上传/图片静态资源（管理后台公用） ======
    location /uploads/ {
        alias /data/dali-now/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        alias /data/dali-now/services/server/images/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # ====== 公开 API ======
    location /api/ {
        proxy_pass http://dali_api;
        # ... 其余代理配置 ...
    }
}
```

> **关键说明**：`/admin/` 的 `try_files` 配置确保 Vue Router history 模式下刷新页面不会 404。当请求的路径不存在时，回退到 `/admin/index.html`，由前端路由接管。

配置完成后重载 Nginx：

```bash
nginx -t && systemctl reload nginx
```

访问 `http://your-domain.com:8080/admin/` 即可打开管理后台登录页。

#### 方式二：Flask 托管静态文件

如果不想配置 Nginx，也可以让 Flask 直接托管管理后台前端文件：

把 `dist/` 目录放在 Flask 项目内，在 `app.py` 中添加静态文件路由：

```python
# 放在 app.py 中，放在其他路由之后
from flask import send_from_directory
import os

ADMIN_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'admin-panel', 'dist')

@app.route('/admin/')
@app.route('/admin/<path:filename>')
def serve_admin(filename='index.html'):
    if filename and '.' in filename:
        return send_from_directory(os.path.join(ADMIN_DIST, 'assets'), filename) \
            if os.path.exists(os.path.join(ADMIN_DIST, 'assets', filename)) \
            else send_from_directory(ADMIN_DIST, filename)
    return send_from_directory(ADMIN_DIST, 'index.html')
```

> ⚠️ 注意：Flask 静态文件托管性能远不如 Nginx，生产环境不推荐此方式。

#### 方式三：PM2 + serve 快速部署

在服务器上通过 `serve` 工具一键托管：

```bash
# 1. 上传 dist 到 /data/www/admin
# 2. 安装 serve
npm install -g serve

# 3. PM2 启动（支持 SPA history 模式）
pm2 start "serve -s /data/www/admin -l 8080 --single" --name dali-admin-panel

# 4. Nginx 反代
#    location /admin/ {
#        proxy_pass http://127.0.0.1:8080;
#    }
```

### 10.5 管理后台功能模块

部署完成后，管理后台提供以下功能：

| 模块 | 路由 | 说明 |
|------|------|------|
| **登录** | `/admin/login` | 管理员账号登录（默认 admin / <your_admin_password>） |
| **仪表盘** | `/admin/dashboard` | 数据概览、统计图表 |
| **活动管理** | `/admin/activities` | 活动的增删改查 |
| **打卡点管理** | `/admin/checkin-points` | 打卡点 CRUD |
| **现场动态** | `/admin/live-posts` | 审核、管理用户发布内容 |
| **社区攻略** | `/admin/community` | 社区内容管理 |
| **首页照片墙** | `/admin/homepage-photos` | 首页照片管理 |
| **本地生活** | `/admin/local-life` | 本地生活分类和项目 |
| **用户管理** | `/admin/users` | 用户查询、审核 |
| **敏感词库** | `/admin/sensitive-words` | 敏感词增删 |
| **系统配置** | `/admin/config` | 应用配置管理 |

### 10.6 管理员登录凭据

默认管理员凭据（部署后务必修改）：

| 配置项 | 默认值 | 如何修改 |
|--------|--------|----------|
| 用户名 | `admin` | 环境变量 `ADMIN_USERNAME` 或 `config.py` |
| 密码 | `<your_admin_password>` | 环境变量 `ADMIN_PASSWORD` 或 `config.py` |
| Token 密钥 | `<your_admin_secret>` | 环境变量 `ADMIN_SECRET` 或 `config.py` |

**强烈建议**：创建 `.env` 文件覆盖默认凭据：

```bash
# services/server/.env
ADMIN_USERNAME=your_admin_user
ADMIN_PASSWORD=your_admin_password_here
ADMIN_SECRET=your_random_secret_key_here
```

### 10.7 Vite 构建配置说明

`admin-panel/vite.config.js` 中的代理配置**仅用于本地开发**，生产环境由 Nginx 处理：

```javascript
// vite.config.js — 仅 dev 模式生效
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',   // 开发时代理到 Flask
      changeOrigin: true
    },
    '/uploads': {
      target: 'http://localhost:5000',
      changeOrigin: true
    },
    '/images': {
      target: 'http://localhost:5000',
      changeOrigin: true
    }
  }
}
```

生产环境构建后，前端打包为纯静态文件，API 请求直接由浏览器发往当前域名的 `/api/admin/`，无需 Vite proxy。

### 10.8 更新部署流程

后续管理后台代码有改动时，执行以下步骤更新：

```bash
# === 本地操作 ===
cd admin-panel
git pull                    # 拉取最新代码
npm install                 # 安装可能新增的依赖
npm run build               # 重新构建

# === 服务器操作（二选一） ===

# 方式 A：覆盖上传（保留旧文件）
scp -r dist/* root@<服务器IP>:/data/www/admin/

# 方式 B：清空后重传（推荐，避免残留旧文件）
ssh root@<服务器IP> "rm -rf /data/www/admin/*"
scp -r dist/* root@<服务器IP>:/data/www/admin/
```

> 静态文件更新后无需重启 Nginx 或 Flask，浏览器刷新即可看到新版本。
> 如果浏览器有缓存，可以 `Ctrl + Shift + R` 强制刷新。

### 10.9 故障排查

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| 页面空白 / 404 | SPA history 模式路径回退未配置 | 确认 Nginx `try_files` 配置正确 |
| 接口 401 / 未登录 | Token 过期或凭据不对 | 重新登录；检查 `.env` 中管理员凭据 |
| 接口 502 / 无响应 | Flask 管理后台未启动 | `pm2 status` 检查 `dali-admin` 进程 |
| 图片加载失败 | `/uploads/` 路径未配置代理 | 检查 Nginx 中 `/uploads/` 的 location 配置 |
| 跨域 CORS 错误 | Flask 未正确设置 CORS 或 Nginx 反代缺失 | 确认 `app.py` 中有 `CORS(app)`；确认 Nginx 反代 `/api/admin/` 到位 |
| 页面样式错乱 | 静态资源路径不对 | 检查 `index.html` 中 `<base href="/admin/">` 或资源引用路径 |
