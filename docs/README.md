# 项目文档

「大理此刻 DaLiNow」文档总索引。建议按以下顺序阅读。

## 1. 入门

| 文档 | 说明 |
|---|---|
| [overview.md](./overview.md) | 项目定位、业务模块与用户角色 |
| [getting-started.md](./getting-started.md) | 本地开发环境搭建与启动 |
| [configuration.md](./configuration.md) | 服务端环境变量与前端配置项说明 |
| [../README.md](../README.md) | 仓库总览 |

## 2. 架构与设计

| 文档 | 说明 |
|---|---|
| [architecture.md](./architecture.md) | 整体架构、请求链路、目录职责、关键约定 |
| [requirements/miniprogram-v1.0.md](./requirements/miniprogram-v1.0.md) | 小程序 V1.0 需求与功能设计说明书 |

## 3. 各子项目

| 子项目 | 文档 | 目录 |
|---|---|---|
| 服务端（Node + Flask） | [modules/server.md](./modules/server.md) | `services/server/` |
| 微信小程序 | [modules/miniprogram.md](./modules/miniprogram.md) | `apps/miniprogram/` |
| 管理后台 | [modules/admin-panel.md](./modules/admin-panel.md) | `apps/admin-panel/` |

## 4. 接口与数据

| 文档 | 说明 |
|---|---|
| [api.md](./api.md) | 公开 API 与管理后台 API 概览、签名与分页约定 |
| [database.md](./database.md) | 表结构、初始化与迁移脚本 |

## 5. 部署与运维

| 文档 | 说明 |
|---|---|
| [deployment/DEPLOY.md](./deployment/DEPLOY.md) | 服务器环境、Nginx、PM2、HTTPS 完整部署流程 |
| [deployment/ssl-certificate.md](./deployment/ssl-certificate.md) | SSL 证书更换手册 |

## 6. 版本记录

| 文档 | 说明 |
|---|---|
| [release/UPGRADE_v2.0.0_ScenicSpots.md](./release/UPGRADE_v2.0.0_ScenicSpots.md) | v2.0.0 景点模块 |
| [release/UPGRADE_v2.1.0_API_Security.md](./release/UPGRADE_v2.1.0_API_Security.md) | v2.1.0 API 安全增强 |
| [../CHANGELOG.md](../CHANGELOG.md) | 变更日志 |

## 7. 社区

| 文档 | 说明 |
|---|---|
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南 |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) | 贡献者行为准则 |
| [../SECURITY.md](../SECURITY.md) | 安全策略与漏洞报告 |
| [../LICENSE](../LICENSE) | MIT 许可证 |

## 文档约定

- 文档统一存放于 `docs/`，按上述分类放入对应子目录
- 涉及敏感信息一律使用占位符（如 `<your_password>`、`your-domain.com`）
- 新增文档请在本索引登记
