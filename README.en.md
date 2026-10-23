# DaLiNow (大理此刻)

[![CI](https://github.com/yayashu/dali-now/actions/workflows/ci.yml/badge.svg)](https://github.com/yayashu/dali-now/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[中文](./README.md) | **English**

> An open-source WeChat Mini Program for real-time travel in Dali: **today's events + official photo spots + on-site field reports**. Node.js/Express public API, Python/Flask admin API, Vue 3 admin panel, one shared MySQL database.

## Why this exists

Travel information in Dali is scattered in three ways: events live inside WeChat groups and word of mouth, so visitors only learn about a ceremony after they arrive; popular photo spots have no guidance, so shots depend on luck; and the real atmosphere of an event rarely leaves someone's private feed.

DaLiNow connects those three gaps — aggregate **today's** events into one searchable entry, provide **official photo-spot guidance**, and archive on-site content per event.

## How it differs from content platforms

Douyin and Xiaohongshu show you Dali through other people's eyes. DaLiNow tells you what is happening **today**, and how you can join it. The difference is the unit of organization.

| | Content platforms | DaLiNow |
|---|---|---|
| Unit | Notes and short videos | Events (time, place, quota, fee are structured fields) |
| Freshness | Decided by the poster | Only today's active events are surfaced |
| Participation | DM or find another entry | In-app booking |
| Photography | Tips buried in comments | Official spots: coordinates, angle, best hours, crowd levels |
| On-site | Algorithmic feed of old posts | Per-event live square, newest first |
| Longevity | Tied to a personal account | Attached to events and spots, searchable |

Complementary, not a replacement: sharing still routes back to WeChat chats and Moments.

## Screenshots

<table>
  <tr>
    <td align="center"><img src="./docs/assets/screenshots/miniprogram/01-index.jpg" width="180" alt="Today's events"><br><sub>Today's events</sub></td>
    <td align="center"><img src="./docs/assets/screenshots/miniprogram/02-activity-detail.jpg" width="180" alt="Event detail"><br><sub>Event detail</sub></td>
    <td align="center"><img src="./docs/assets/screenshots/miniprogram/04-checkin.jpg" width="180" alt="Official photo spots"><br><sub>Photo spots</sub></td>
    <td align="center"><img src="./docs/assets/screenshots/miniprogram/07-live.jpg" width="180" alt="On-site feed"><br><sub>On-site feed</sub></td>
  </tr>
</table>

## Tech stack

| Layer | Stack |
|---|---|
| Public API | Node.js 18+, Express, mysql2, HMAC-signed requests, rate limiting |
| Admin API | Python 3.9+, Flask, token auth |
| Mini Program | Native WeChat Mini Program, 29 pages |
| Admin panel | Vue 3, Vite 5, Element Plus, ECharts |
| Database | MySQL 8, 23 tables, utf8mb4 |

## Quick start

```bash
# 1. database
cd services/server
cp .env.example .env        # fill DB / WeChat / API secret placeholders
npm install
npm run init-db

# 2. backend
npm run dev                 # public API on :3000
python app.py               # admin API on :5000

# 3. mini program
# open apps/miniprogram in WeChat DevTools, set your appid,
# then edit utils/config.js (SERVER_HOST, API_SECRET)

# 4. admin panel
cd apps/admin-panel
npm install && npm run dev  # http://localhost:5173
```

## Documentation

- [Requirements & feature design](./docs/requirements/miniprogram-v1.0.md) — includes an appendix mapping every requirement to its actual implementation status
- [Architecture](./docs/architecture.md) — dual backends, request flow, project layout
- [API overview](./docs/api.md) — endpoints, signing, pagination
- [Database](./docs/database.md) — 23 tables, init and migration scripts
- [Configuration](./docs/configuration.md) — environment variables and frontend config
- [Deployment](./docs/deployment/DEPLOY.md) — Nginx, PM2, HTTPS

## Project status

The core loop works end to end: browse, book, check in, post on site, browse community, and manage content in the admin panel. Several designed capabilities are **not** implemented — online payment, subscription-message reminders, role-based access control, and scheduled cleanup. The gap list is in [appendix A](./docs/requirements/miniprogram-v1.0.md#附录-a需求实现对照截至-2026-10-23).

## Scope and licensing

No real credentials are committed: database password, WeChat AppID/Secret, API signing key and map AK are all placeholders or environment variables. Seed images are for demonstration only — replace them before production use.

MIT License, see [LICENSE](./LICENSE).
