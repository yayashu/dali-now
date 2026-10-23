# 变更日志

本项目的显著变更记录于此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [开源版] - 2026-10-23

### 新增
- 仓库整理为 monorepo：
  - `services/server/`：Node.js 公开 API + Flask 管理后台 API
  - `apps/miniprogram/`：微信小程序
  - `apps/admin-panel/`：管理后台前端
- 顶层 `docs/` 文档目录：总览、架构、快速开始、接口、数据库、子项目说明、部署、版本记录
- `.github/` Issue / PR 模板与 CI（服务端语法检查、Python 编译、前端构建）
- `README.md`、`LICENSE`（MIT）、`CONTRIBUTING.md`、`SECURITY.md`、`CHANGELOG.md`、`.editorconfig`、`.gitattributes`
- 界面预览截图 17 张（`docs/assets/screenshots/`，小程序 10 张 + 管理后台 7 张），README 与子项目文档已引用
- 产品文档 `docs/requirements/miniprogram-v1.0.md`：由《大理此刻小程序 V1.0 需求与功能设计说明书（正式交付版）》Word 版转写为 Markdown，并附「需求实现对照」附录（17 个模块实现状态 + 16 项待实现子功能）
- `llms.txt`：面向生成式 AI 检索的项目说明（定位、技术栈、文档索引、可引用事实要点）
- `docs/assets/social-preview.png`：GitHub 社交预览图（1280×640）

### 变更
- 全部敏感信息从仓库移除（数据库密码、微信 AppID/Secret、管理员账号、API 签名密钥），改为环境变量或占位配置
- 部署资源统一到 `services/server/deploy/`（Nginx、PM2、Linux/Windows 脚本）
- Windows 启动脚本去除本机绝对路径
- 清理开源版遗留：客服邮箱改为占位地址、示例域名替换为 `your-domain.com`、旧项目名 `dali-moment` 改名、数据库端口统一为 `3306`
- `README.md` 开头新增「设计初衷」「设计理念」「和内容平台有什么不同」三节，并修正「项目状态」表述以区分「代码完整开源」与「功能全部实现」
- `README.md` 首屏定位文案改为关键词前置，并新增「常见问题」小节（6 条结构化问答）
- `SECURITY.md` 新增「仓库卫生」章节与第三方凭证检查项；`docs/configuration.md` 新增「第三方服务凭证」说明
- `services/server/package.json` 补充 `keywords` 字段
- 管理后台百度地图 AK 改为环境变量注入：`apps/admin-panel/index.html` 使用 `%VITE_BAIDU_MAP_AK%`，新增 `apps/admin-panel/.env.example`，仓库内不再保留任何第三方 AK 明文
- 数据字典补齐 `scenic_spots`（`config.py` 的 `TABLES` 同步），表数口径统一为 23 张；补齐 6 张缺失的种子图片；修正迁移脚本与 `init_mysql.py` 的路径

### 修复
- 重写被批量替换损坏的 `docs/deployment/ssl-certificate.md`
- 重写小程序端 README（对齐当前 29 个页面与目录结构），新增 `docs/configuration.md` 与 `CODE_OF_CONDUCT.md`

### 移除
- 运行日志、依赖目录、编译缓存、垃圾文件不纳入仓库
- H5 移动端：`apps/h5/`、`docs/modules/h5.md`、`/api/auth/h5` 系列接口（`routes/auth-h5.js`）与 `sql/migrate_h5_auth.sql`，CI 中的 H5 构建任务同步下线
- 小程序精简版：`apps/miniprogram-lite/`，`docs/modules/miniprogram.md` 中的精简版差异说明同步移除

## [2.1.0] - API 安全增强

- 公开 API 请求签名验证（HMAC-SHA256，时间窗口 ±5 分钟）
- 全局与搜索接口 IP 频率限制
- 管理后台 Token 改为 HMAC 签名（兼容多 Worker）
- 详情见 [docs/release/UPGRADE_v2.1.0_API_Security.md](./docs/release/UPGRADE_v2.1.0_API_Security.md)

## [2.0.0] - 景点模块

- 新增景点（Scenic Spots）模块与公开 API
- 详情见 [docs/release/UPGRADE_v2.0.0_ScenicSpots.md](./docs/release/UPGRADE_v2.0.0_ScenicSpots.md)

## [1.0.0] - 初始版本

- 双后端架构（Node.js Express + Python Flask），MySQL 存储
- 活动 / 景点 / 打卡 / 现场动态 / 社区 / 本地生活 / 搜索 / 用户等模块
- 微信小程序、H5、管理后台三端
