# 安全策略

## 报告漏洞

如果你发现安全漏洞，请**不要**在公开 Issue 中提交，而是通过邮箱联系：

- 客服邮箱：security@your-domain.com

我们会在收到报告后尽快评估并回复。

## 内置安全机制

| 机制 | 位置 | 说明 |
|---|---|---|
| 请求签名验证 | `services/server/middleware/signature.js` | 公开 API 的 GET 请求需携带 HMAC-SHA256 签名（±5 分钟窗口） |
| IP 频率限制 | `services/server/app.js` | 全局 100 次/分钟，搜索 30 次/分钟 |
| 管理后台认证 | `services/server/admin_api.py` | HMAC 签名 Token（`X-Admin-Token`，24 小时），登录接口 Nginx 限流 5 次/分钟 |
| 敏感词过滤 | `services/server/middleware/sensitive-filter.js` | 写入接口统一过滤 |
| 安全响应头 | `services/server/deploy/nginx/dali-now.conf` | X-Frame-Options / X-Content-Type-Options / HSTS |
| 传输加密 | Nginx | TLS 1.2/1.3，生产环境强制 HTTPS |

## 仓库卫生

- 任何可计费的第三方凭证（地图 JS AK、对象存储 AccessKey、支付商户密钥、短信 Key）都不应写入受版本管理的文件，应通过环境变量或部署时注入
- 前端项目中的公开密钥（如地图 JS AK）会随页面下发，无法真正隐藏，但仍需在服务商控制台绑定域名 / Referer 白名单，避免被第三方盗用配额
- 若凭证曾进入版本历史，仅删除当前文件并不够，必须在服务商控制台**重置**该凭证
- 提交前自检：搜索结果中不应出现 `ak=`、`secret=`、`password=` 后跟真实值的内容

## 部署安全清单

- [ ] 修改 `.env` 中所有默认密码（数据库、管理员账号、签名密钥）
- [ ] 数据库不使用 `root` 对外，创建最小权限业务账号
- [ ] 数据库端口不暴露公网，仅监听 `127.0.0.1` 或走内网
- [ ] `ADMIN_SECRET` 与 `API_SECRET` 使用足够随机的长字符串
- [ ] 两端 `API_SECRET` 保持一致（服务端 + 小程序）
- [ ] 替换第三方凭证（地图 AK、对象存储 AccessKey 等）并在服务商控制台绑定域名 / Referer 白名单
- [ ] 生产环境启用 HTTPS（见 `docs/deployment/ssl-certificate.md`）
- [ ] 定期检查 Nginx / PM2 日志中的异常访问
