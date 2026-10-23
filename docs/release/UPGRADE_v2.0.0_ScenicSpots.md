# 大理此刻 v2.0.0 — 景区管理 & 打卡点景区关联 升级文档

> **版本**: v2.0.0  
> **更新日期**: 2026-06-16  
> **涉及范围**: 数据库 / Python Flask / Node.js Express / 微信小程序  
> **路径说明**: 本文档写于 monorepo 整理之前，文中 `dali-now-server/` 为当时的仓库名，对应现仓库的 `services/server/`

---

## 目录

- [一、变更概览](#一变更概览)
- [二、数据库变更](#二数据库变更)
- [三、后端变更](#三后端变更)
  - [3.1 Python Flask (`admin_api.py`)](#31-python-flask-admin_apipy)
  - [3.2 Python Flask (`app.py`)](#32-python-flask-apppy)
  - [3.3 Node.js Express (`routes/scenic-spots.js`)](#33-nodejs-express-routesscenic-spotsjs)
  - [3.4 Node.js Express (`routes/checkin.js`)](#34-nodejs-express-routescheckinjs)
  - [3.5 Node.js Express (`app.js`)](#35-nodejs-express-appjs)
- [四、小程序前端变更](#四小程序前端变更)
  - [4.1 新增页面](#41-新增页面)
  - [4.2 已有页面更新](#42-已有页面更新)
  - [4.3 工具模块](#43-工具模块)
- [五、完整 API 接口清单](#五完整-api-接口清单)
  - [5.1 管理后台 API](#51-管理后台-api)
  - [5.2 公开 API](#52-公开-api)
- [六、升级操作步骤](#六升级操作步骤)
- [七、回滚方案](#七回滚方案)
- [八、测试验证清单](#八测试验证清单)
- [九、注意事项](#九注意事项)

---

## 一、变更概览

本次升级新增 **景区管理** 完整功能，同时为打卡点增加 **所属景区关联** 字段。

| 层面 | 变更类型 | 说明 |
|------|---------|------|
| 数据库 | 新增表 + 改表 | 新建 `scenic_spots` 表(33字段)；`checkin_points` 增加 `scenic_spot_id` |
| Flask 后端 | 新增路由 + 改造 | `admin_api.py` 增加景区 CRUD/模板/导入；`app.py` 增加公开景区 API；打卡点 API 追加景区名称 |
| Node.js 后端 | 新增路由 + 改造 | `routes/scenic-spots.js` 新增；`routes/checkin.js` / `app.js` 追加景区名称与迁移检查 |
| 小程序前端 | 新增页面 + 改造 | 管理员登录 + 景区列表/编辑页；打卡列表/详情页追加景区字段显示 |

---

## 二、数据库变更

### 2.1 迁移脚本

**文件**: `scripts/migrate_scenic_spots.sql`

```bash
mysql -u root -p dali_now < scripts/migrate_scenic_spots.sql
```

### 2.2 新建表 `scenic_spots`

| 分类 | 字段名 | 类型 | 说明 |
|------|--------|------|------|
| 🔤 基础 | `id` | INT AUTO_INCREMENT PK | 主键 |
| | `name` | VARCHAR(200) NOT NULL | 景区名称 |
| | `district_code` | VARCHAR(50) | 所属区域 code |
| | `level` | VARCHAR(20) | 景区级别: 5A / 4A / 3A / 2A / A |
| | `tags` | VARCHAR(500) | 标签（逗号分隔） |
| | `status` | VARCHAR(20) DEFAULT 'active' | active / inactive |
| | `sort_order` | INT DEFAULT 0 | 排序权重 |
| | `popularity` | INT DEFAULT 0 | 热度值 |
| 🖼️ 图片 | `cover` | TEXT | 封面图 URL |
| | `images` | JSON | 多图数组 `[{"url":"...","desc":"..."}]` |
| 📝 介绍 | `description` | TEXT | 景区简介 |
| | `overview` | TEXT | 景区概况（长文本） |
| 🚪 入口 | `entrance` | VARCHAR(500) | 入口描述 |
| | `entrance_lat` | DOUBLE | 入口纬度 |
| | `entrance_lng` | DOUBLE | 入口经度 |
| 🅿️ 停车场 | `parking` | TEXT | 停车场信息 |
| | `parking_lat` | DOUBLE | 停车场纬度 |
| | `parking_lng` | DOUBLE | 停车场经度 |
| | `parking_fee` | VARCHAR(100) | 停车费 |
| 🎫 门票 | `ticket_type` | VARCHAR(20) DEFAULT 'free' | free / paid |
| | `ticket_price` | DECIMAL(10,2) DEFAULT 0.00 | 门票价格(元) |
| | `ticket_note` | TEXT | 票价补充说明 |
| | `half_price_note` | TEXT | 优惠政策 |
| ⏰ 开放 | `open_time` | VARCHAR(200) | 开放时间 |
| | `close_time` | VARCHAR(200) | 关闭时间 |
| | `best_season` | VARCHAR(200) | 最佳游览季节 |
| | `suggested_time` | VARCHAR(100) | 建议游览时长 |
| 📍 位置 | `address` | VARCHAR(500) | 详细地址 |
| | `latitude` | DOUBLE | 景区中心纬度 |
| | `longitude` | DOUBLE | 景区中心经度 |
| | `phone` | VARCHAR(50) | 联系电话 |
| | `website` | VARCHAR(200) | 官网 |
| 🏪 配套 | `facilities` | TEXT | 配套设施 |
| | `transport` | TEXT | 交通指南 |
| | `notice` | TEXT | 注意事项 |
| | `tips` | TEXT | 游览贴士 |
| 📅 时间戳 | `created_at` | DATETIME | 创建时间 |
| | `updated_at` | DATETIME | 更新时间 |

**索引**:
- `idx_scenic_spots_name` (name)
- `idx_scenic_spots_district` (district_code)
- `idx_scenic_spots_status` (status)
- `idx_scenic_spots_level` (level)

### 2.3 `checkin_points` 表新增字段

```sql
ALTER TABLE checkin_points
    ADD COLUMN IF NOT EXISTS scenic_spot_id INT DEFAULT NULL AFTER activity_id,
    ADD INDEX IF NOT EXISTS idx_checkin_points_ssid (scenic_spot_id);
```

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `scenic_spot_id` | INT | NULLABLE, 无外键约束 | 关联 scenic_spots.id，非必填 |

> **为什么不用外键？** 景区可能被删除，但打卡点仍需保留，删除景区时后端会将关联打卡点的 `scenic_spot_id` 置 NULL。

---

## 三、后端变更

### 3.1 Python Flask (`admin_api.py`)

#### 新增：景区管理 CRUD（共 8 个端点）

| 方法 | 路由 | 认证 | 功能 |
|------|------|------|------|
| GET | `/api/admin/scenic-spots` | `@admin_required` | 分页列表（支持 keyword/district/status 筛选），附带 district_name |
| GET | `/api/admin/scenic-spots/search` | `@admin_required` | 轻量搜索（仅返回 id+name），供下拉选择器使用 |
| GET | `/api/admin/scenic-spots/<id>` | `@admin_required` | 景区详情 |
| POST | `/api/admin/scenic-spots` | `@admin_required` | 创建景区 |
| PUT | `/api/admin/scenic-spots/<id>` | `@admin_required` | 更新景区 |
| DELETE | `/api/admin/scenic-spots/<id>` | `@admin_required` | 删除景区（联动清理打卡点 `scenic_spot_id`） |
| GET | `/api/admin/scenic-spots/template` | `@admin_required` | 下载 Excel 导入模板（openpyxl 生成） |
| POST | `/api/admin/scenic-spots/import` | `@admin_required` | Excel 批量导入景区 |

#### 改造：打卡点管理

- **列表**（`GET /api/admin/checkin/points`）：返回结果追加 `scenic_spot_name` 字段
- **创建/更新/导入**：`fields` 和 `updatable` 列表均新增 `scenic_spot_id`
- **Excel 导入模板**：检查点模板表头新增 `所属景区ID(选填)` 列

### 3.2 Python Flask (`app.py`)

#### 新增：公开景区 API

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | `/api/scenic-spots` | 景区列表（keyword 搜索，仅返回 active，最多 200 条） |
| GET | `/api/scenic-spots/<id>` | 景区详情（全字段） |

#### 新增：辅助函数

```python
def _attach_scenic_spot_names(points):
    """批量附加景区名称到打卡点列表"""
```

#### 改造：公开打卡点 API

- `GET /api/checkin/points` — 列表返回追加 `scenic_spot_name`（含 fallback 地理排序分支）
- `GET /api/checkin/points/<id>` — 详情返回追加 `scenic_spot_name`
- `POST /api/checkin/points/submit` — fields 新增 `scenic_spot_id`

### 3.3 Node.js Express (`routes/scenic-spots.js`)

**全新文件**，提供公开景区 API：

| 方法 | 路由 | 功能 |
|------|------|------|
| GET | `/api/scenic-spots` | 景区列表（keyword 搜索，模糊匹配） |
| GET | `/api/scenic-spots/:id` | 景区详情 |

### 3.4 Node.js Express (`routes/checkin.js`)

- **列表**（`GET /api/checkin/points`）：批量查询景区名称，使用 `IN` 查询一次性附加 `scenic_spot_name`
- **详情**（`GET /api/checkin/points/:id`）：单独查询景区名称
- **提交**（`POST /api/checkin/points/submit`）：fields 新增 `scenic_spot_id`
- **缓存刷新**：读取 fields 列表新增 `scenic_spot_id`

### 3.5 Node.js Express (`app.js`)

- 注册新路由：`app.use('/api/scenic-spots', require('./routes/scenic-spots'))`
- `checkMigrations()` 新增景区相关检查：
  - `scenic_spots` 表是否存在
  - `checkin_points` 是否包含 `scenic_spot_id` 字段
  - 缺失时输出控制台警告

---

## 四、小程序前端变更

### 4.1 新增页面

#### 管理员登录 — `pages/admin/login/login`

| 文件 | 说明 |
|------|------|
| `login.js` | 登录逻辑：已有 token 自动跳转；输入验证；调用 `adminPost('/login')` 获取 token |
| `login.wxml` | 登录表单 UI（用户名/密码输入 + 提交按钮） |
| `login.wxss` | 登录页样式 |
| `login.json` | 页面配置 |

#### 景区列表 — `pages/admin/scenic-spots/list/list`

| 文件 | 说明 |
|------|------|
| `list.js` | 分页查询 + 关键字搜索 + 删除确认；onShow 自动刷新；FAB 新增；退出登录 |
| `list.wxml` | 搜索栏 + 列表卡片（名称/区域/级别/状态）+ 底部 FAB |
| `list.wxss` | 列表页样式 |
| `list.json` | 页面配置 |

#### 景区编辑/创建 — `pages/admin/scenic-spots/edit/edit`

| 文件 | 说明 |
|------|------|
| `edit.js` | 完整表单逻辑：区域选择器、门票类型/级别/状态单选、图片上传(封面+多图)、地图选点(入口/停车场/景区) |
| `edit.wxml` | 分组表单 UI（基础/位置/入口/停车场/门票/开放时间/介绍/配套） |
| `edit.wxss` | 表单页样式 |
| `edit.json` | 页面配置 |

#### 页面注册 (`app.json`)

```json
"pages/admin/login/login",
"pages/admin/scenic-spots/list/list",
"pages/admin/scenic-spots/edit/edit"
```

### 4.2 已有页面更新

#### 打卡列表 — `pages/checkin/checkin`

| 文件 | 变更 |
|------|------|
| `checkin.wxml` | 描述下方新增景区标签行：`<view class="chk-scenic">` 显示 🏛 + scenic_spot_name |
| `checkin.wxss` | 新增 `.chk-scenic` / `.chk-scenic-icon` / `.chk-scenic-text` 样式（绿色标签风格） |

#### 打卡详情 — `pages/checkin-detail/checkin-detail`

| 文件 | 变更 |
|------|------|
| `checkin-detail.wxml` | 标题行下方新增景区信息行：`🏛 所属景区：{{point.scenic_spot_name}}` |
| `checkin-detail.wxss` | 新增 `.detail-scenic` / `.detail-scenic-icon` / `.detail-scenic-text` 样式 |

#### 首页今日活动 — `pages/index/index.js`

| 文件 | 变更 |
|------|------|
| `index.js` | 第 146 行：区域过滤字段从 `item.district` 修正为 `item.district_code`（Bug 修复） |

### 4.3 工具模块

#### 新建 `utils/admin.js`

| 函数 | 功能 | 路径映射 |
|------|------|---------|
| `adminRequest(method, path, data)` | 通用管理后台请求，自动附加 `X-Admin-Token` 头 | `API_BASE + '/admin' + path` |
| `adminGet(path, params)` | 管理后台 GET 请求 | 同上 |
| `adminPost(path, data)` | 管理后台 POST 请求 | 同上 |
| `adminPut(path, data)` | 管理后台 PUT 请求 | 同上 |
| `adminDelete(path, data)` | 管理后台 DELETE 请求 | 同上 |

**认证过期处理**: 当返回 `code === -1` 且含"登录"字样，或 HTTP 401 时，自动清除 token 并跳转到登录页。

#### 改造 `utils/db.js`

- `TABLES` 新增: `SCENIC_SPOTS: 'scenic_spots'`
- `_readTable()` switch 新增 `SCENIC_SPOTS` 分支，调用 `GET /api/scenic-spots`

---

## 五、完整 API 接口清单

### 5.1 管理后台 API

> 所有管理后台接口路径均需前缀 `/api/admin`，请求头携带 `X-Admin-Token`。

#### 认证

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| POST | `/api/admin/login` | `{ username, password }` | `{ code: 0, data: { token, username } }` |
| POST | `/api/admin/logout` | — | `{ code: 0, msg: "已退出" }` |
| GET | `/api/admin/check` | — | `{ code: 0, data: { username } }` |

#### 景区管理

| 方法 | 路径 | 请求参数/体 | 响应 |
|------|------|-------------|------|
| GET | `/api/admin/scenic-spots` | `?page=1&size=20&keyword=&district=&status=` | `{ code: 0, data: { list, total, page, size } }` |
| GET | `/api/admin/scenic-spots/search` | `?keyword=&limit=50` | `{ code: 0, data: [{ id, name }] }` |
| GET | `/api/admin/scenic-spots/:id` | — | `{ code: 0, data: { ...全字段 } }` |
| POST | `/api/admin/scenic-spots` | JSON（33 字段） | `{ code: 0, data: { id }, msg: "创建成功" }` |
| PUT | `/api/admin/scenic-spots/:id` | JSON（需更新的字段） | `{ code: 0, msg: "更新成功" }` |
| DELETE | `/api/admin/scenic-spots/:id` | — | `{ code: 0, msg: "已删除" }` |
| GET | `/api/admin/scenic-spots/template` | — | Excel 文件流下载 |
| POST | `/api/admin/scenic-spots/import` | multipart `file` | `{ code: 0, data: { success, errors, total } }` |

#### 打卡点管理（改造部分）

> 打卡点的 list/create/update/import 接口路径不变，以下列出新增字段。

**新增请求/响应字段**: `scenic_spot_id` (INT, 选填)  
**列表新增响应字段**: `scenic_spot_name` (自动附带)

### 5.2 公开 API

> 前缀 `/api`，无需认证。

| 方法 | 路径 | 请求参数 | 响应 |
|------|------|----------|------|
| GET | `/api/scenic-spots` | `?keyword=` (可选) | `{ code: 0, data: [{ id, name, cover, district_code }] }` |
| GET | `/api/scenic-spots/:id` | — | `{ code: 0, data: { ...全字段 } }` |
| GET | `/api/checkin/points` | `?page=&size=&type=&keyword=` | 列表每项新增 `scenic_spot_name` 字段 |
| GET | `/api/checkin/points/:id` | — | 详情新增 `scenic_spot_name` 字段 |
| POST | `/api/checkin/points/submit` | JSON | 请求体可选 `scenic_spot_id` |

---

## 六、升级操作步骤

### 步骤 1：备份数据库

```bash
mysqldump -u root -p dali_now > dali_now_backup_$(date +%Y%m%d).sql
```

### 步骤 2：执行数据库迁移

```bash
mysql -u root -p dali_now < /path/to/dali-now-server/scripts/migrate_scenic_spots.sql
```

验证迁移：

```sql
-- 确认 scenic_spots 表已创建
DESC scenic_spots;

-- 确认 checkin_points 新增 scenic_spot_id 字段
DESC checkin_points;
```

### 步骤 3：更新后端代码

```bash
cd /path/to/dali-now-server

# 拉取最新代码
git pull origin main

# 安装 Python 依赖（无新增，但如果之前未安装 openpyxl 需执行）
pip install -r requirements.txt

# Node.js 依赖（无新增）
npm install
```

### 步骤 4：重启服务

```bash
# PM2 方式（推荐）
pm2 restart all

# 或单独重启
pm2 restart dali-now-flask
pm2 restart dali-now-node
```

验证服务：

```bash
# 测试公开 API
curl https://your-domain/api/scenic-spots

# 测试管理后台 API（需先登录获取 token）
curl -X POST https://your-domain/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### 步骤 5：更新小程序前端

1. 在微信开发者工具中打开 `dali-now-app` 项目
2. 点击「编译」确认无报错
3. 点击「上传」提交代码
4. 在微信公众平台提交审核

---

## 七、回滚方案

### 数据库回滚

```sql
-- 删除景区表
DROP TABLE IF EXISTS scenic_spots;

-- 移除打卡点关联字段
ALTER TABLE checkin_points DROP COLUMN IF EXISTS scenic_spot_id;
ALTER TABLE checkin_points DROP INDEX IF EXISTS idx_checkin_points_ssid;
```

### 代码回滚

```bash
git revert <commit-hash>
pm2 restart all
```

### 小程序回滚

在微信公众平台「版本管理」中回退到上一个已发布的版本。

---

## 八、测试验证清单

### 数据库

- [ ] `scenic_spots` 表已创建，所有字段和索引正确
- [ ] `checkin_points` 表已增加 `scenic_spot_id` 字段
- [ ] 迁移脚本可重复执行不报错（`IF NOT EXISTS`）

### 后端 — 管理后台 API

- [ ] 登录 `/api/admin/login` 正常返回 token
- [ ] 创建景区成功，返回 id
- [ ] 分页查询景区列表正常，筛选条件生效
- [ ] 景区搜索接口 `/scenic-spots/search` 返回 id+name
- [ ] 更新景区字段成功
- [ ] 删除景区后，关联打卡点的 `scenic_spot_id` 被置 NULL
- [ ] Excel 模板下载正常
- [ ] Excel 批量导入成功，error 行正确报告
- [ ] 打卡点列表返回包含 `scenic_spot_name`
- [ ] 创建/更新打卡点时 `scenic_spot_id` 字段生效

### 后端 — 公开 API

- [ ] `GET /api/scenic-spots` 返回 active 景区列表
- [ ] `GET /api/scenic-spots?keyword=洱海` 模糊搜索正确
- [ ] `GET /api/scenic-spots/:id` 返回全字段
- [ ] 打卡点列表每项包含 `scenic_spot_name`
- [ ] 打卡点详情包含 `scenic_spot_name`

### 小程序 — 管理后台

- [ ] 未登录时访问景区列表自动跳转登录页
- [ ] 登录成功后跳转景区列表
- [ ] 景区列表支持分页加载
- [ ] 搜索景区功能正常
- [ ] 点击 + 按钮跳转新建页
- [ ] 新建景区表单所有字段可填写
- [ ] 图片上传（封面+多图）正常
- [ ] 地图选点（入口/停车场/景区位置）正常
- [ ] 区域下拉选择器正常
- [ ] 门票类型/级别/状态单选切换正常
- [ ] 编辑已有景区，数据正确回填
- [ ] 删除景区二次确认后成功删除
- [ ] token 过期自动跳转登录页
- [ ] 退出登录清除 token

### 小程序 — 用户端

- [ ] 打卡列表页显示所属景区标签
- [ ] 打卡详情页显示所属景区信息
- [ ] 未绑定景区的打卡点不显示景区标签
- [ ] 今日活动区域选择过滤正常（regression）

---

## 九、注意事项

### 性能考虑

- **景区搜索下拉**（`/api/admin/scenic-spots/search`）：轻量接口，仅返回 id+name，限制 50 条。景区数量大时使用 LIKE 模糊匹配 + 索引优化。
- **打卡点列表批量附加景区名**：Node.js 侧使用 `WHERE id IN (...)` 批量查询，避免 N+1 问题；Flask 侧同理使用 `_attach_scenic_spot_names()` 辅助函数。

### 安全

- 管理后台所有接口均受 `@admin_required` 装饰器 / HMAC Token 认证保护
- 公开景区 API 仅返回 `status='active'` 的数据，不会泄露未发布/已下线的景区

### 兼容性

- `scenic_spot_id` 为 **非必填** 字段，不传或传 NULL 均可，完全向后兼容
- 打卡点列表中 `scenic_spot_name` 为空字符串时前端不渲染标签行
- 双后端（Flask + Node.js）均同步更新，不会出现 API 不一致

### 数据导入模板

#### 景区导入 Excel 模板列

| 序号 | 表头 | 映射字段 |
|------|------|----------|
| 1 | 景区名称 | name |
| 2 | 所属区域code | district_code |
| 3 | 封面图链接 | cover |
| 4 | 简介 | description |
| 5 | 概况 | overview |
| 6 | 入口描述 | entrance |
| 7 | 入口纬度 | entrance_lat |
| 8 | 入口经度 | entrance_lng |
| 9 | 停车场信息 | parking |
| 10 | 停车场纬度 | parking_lat |
| 11 | 停车场经度 | parking_lng |
| 12 | 停车费 | parking_fee |
| 13 | 门票类型(free/paid) | ticket_type |
| 14 | 门票价格(元) | ticket_price |
| 15 | 票价说明 | ticket_note |
| 16 | 优惠政策 | half_price_note |
| 17 | 开放时间 | open_time |
| 18 | 关闭时间 | close_time |
| 19 | 最佳季节 | best_season |
| 20 | 建议游览时长 | suggested_time |
| 21 | 地址 | address |
| 22 | 纬度 | latitude |
| 23 | 经度 | longitude |
| 24 | 电话 | phone |
| 25 | 官网 | website |
| 26 | 级别(5A/4A/3A) | level |
| 27 | 标签 | tags |
| 28 | 配套设施 | facilities |
| 29 | 交通指南 | transport |
| 30 | 注意事项 | notice |
| 31 | 游览贴士 | tips |
| 32 | 热度 | popularity |
| 33 | 排序 | sort_order |

---

## 附录：变更文件清单

### 新增文件

```
dali-now-server/
├── scripts/migrate_scenic_spots.sql           # 数据库迁移 SQL
├── routes/scenic-spots.js                     # Node.js 公开景区 API

dali-now-app/
├── utils/admin.js                             # 管理后台 API 工具
├── pages/admin/login/login.js                 # 管理员登录页面
├── pages/admin/login/login.wxml
├── pages/admin/login/login.wxss
├── pages/admin/login/login.json
├── pages/admin/scenic-spots/list/list.js      # 景区列表页面
├── pages/admin/scenic-spots/list/list.wxml
├── pages/admin/scenic-spots/list/list.wxss
├── pages/admin/scenic-spots/list/list.json
├── pages/admin/scenic-spots/edit/edit.js      # 景区编辑/创建页面
├── pages/admin/scenic-spots/edit/edit.wxml
├── pages/admin/scenic-spots/edit/edit.wxss
├── pages/admin/scenic-spots/edit/edit.json
```

### 修改文件

```
dali-now-server/
├── admin_api.py                   # 新增景区 CRUD (8个端点)；打卡点 list/create/update/import 增加 scenic_spot_id
├── app.py                         # 新增公开景区 API、_attach_scenic_spot_names；打卡点 API 追加景区名
├── app.js                         # 注册 scenic-spots 路由；checkMigrations 增加景区表检查
├── routes/checkin.js              # 列表/详情/提交 支持 scenic_spot_id + scenic_spot_name

dali-now-app/
├── app.json                       # 注册 admin 页面路径
├── utils/db.js                    # TABLES 新增 SCENIC_SPOTS
├── pages/index/index.js           # 修复区域过滤字段 item.district → item.district_code
├── pages/checkin/checkin.wxml     # 新增景区标签行
├── pages/checkin/checkin.wxss     # 新增景区标签样式
├── pages/checkin-detail/checkin-detail.wxml   # 新增所属景区行
├── pages/checkin-detail/checkin-detail.wxss   # 新增所属景区样式
```

---

> **文档维护**: 本文件随 dali-now-server 仓库版本管理，每次重大升级请更新此文档。
