# SSL 证书更换手册

Nginx 的 HTTPS 入口证书更换流程。当前配置见 `services/server/deploy/nginx/dali-now.conf`。

## 当前配置摘要

| 项 | 值 |
|---|---|
| 域名 | `your-domain.com`（按实际部署替换） |
| 证书来源 | 阿里云 SSL（Nginx 类型 .pem/.key） |
| 证书文件（服务器） | `/etc/nginx/cert/<domain>.pem`<br>`/etc/nginx/cert/<domain>.key` |
| Nginx 配置 | `/etc/nginx/conf.d/dali-now.conf` |
| 协议 | `TLSv1.2 TLSv1.3` + 高安全 cipher 套件（无需改动） |

> 项目使用手动部署的商业证书（非 Let's Encrypt），**没有自动续期**，到期需手动替换。只需覆盖服务器上的两个证书文件并 reload，无需修改 Nginx 配置。

## 操作步骤

### 1. 下载新证书

阿里云控制台 → 数字证书管理服务（SSL 证书）→ 对应域名 → 下载类型选 **Nginx**，得到 `.pem`（含证书链）与 `.key`。

### 2. 登录服务器并备份旧证书

```bash
ssh root@<服务器IP>
mkdir -p /etc/nginx/cert/backup-<日期>
cp /etc/nginx/cert/<domain>.pem /etc/nginx/cert/<domain>.key /etc/nginx/cert/backup-<日期>/
```

### 3. 上传新证书并覆盖

```bash
# 在本机执行
scp <domain>.pem <domain>.key root@<服务器IP>:/etc/nginx/cert/
```

> 若下载文件名与服务器上不一致，先改名为配置中引用的文件名，避免改动 Nginx 配置。

### 4. 校验证书

```bash
chmod 600 /etc/nginx/cert/<domain>.key
openssl x509 -noout -dates -in /etc/nginx/cert/<domain>.pem     # 有效期
openssl x509 -noout -subject -in /etc/nginx/cert/<domain>.pem   # 域名 CN/SAN
```

### 5. 测试并热重载

```bash
nginx -t                 # 需显示 successful
systemctl reload nginx   # 热重载，不中断服务
```

### 6. 验证线上生效

```bash
echo | openssl s_client -servername <域名> -connect <域名>:443 2>/dev/null | openssl x509 -noout -dates
curl -s https://<域名>/api/health
```

## 提醒

- 阿里云免费证书现多为 3 个月有效期，建议记录到期时间并定期轮换
- 若更换域名，需同步修改 `services/server/deploy/nginx/dali-now.conf` 中的 `server_name` 与 `ssl_certificate*` 路径
- 密钥文件权限保持 `600`，属主 `root`
