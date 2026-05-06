# FiberHomeManage Backend Production Guide

## 1) Deployment architecture (recommended)

- Runtime: Node.js 20 LTS
- Process model: stateless API instances behind reverse proxy/load balancer
- Data: MongoDB Atlas (primary), local MongoDB for development only
- Files: move uploads to object storage (S3/Cloudflare R2) for multi-instance scaling
- TLS: HTTPS terminated at edge (Render/NGINX/Caddy)

---

## 2) Environment setup

Use `backendfiber/.env.production.example` as template.

Required production variables:

- `NODE_ENV=production`
- `MONGODB_URI` (Atlas SRV URI, least-privilege DB user)
- `JWT_SECRET` (64+ random chars)
- `PUBLIC_API_BASE_URL`
- `CORS_ORIGIN` (comma-separated allowlist)
- `API_REQUIRE_AUTH=true`
- `TRUST_PROXY=1` (or hop count)

Security rules:

- Never commit `.env` files
- Store secrets only in platform secret manager
- Rotate `JWT_SECRET` and DB credentials on schedule

---

## 3) MongoDB setup (local + cloud)

### Local dev

1. Install MongoDB Community or run Docker:
   - `docker run -d --name fiber-mongo -p 27017:27017 mongo:7`
2. Set:
   - `MONGODB_URI=mongodb://localhost:27017/fiberhomemanage`
3. Use low pool settings for local.

### Cloud (MongoDB Atlas)

1. Create project + M10+ cluster.
2. Create dedicated DB user for app (`readWrite` on app DB only).
3. Restrict network access:
   - Render: allow Render egress ranges if fixed; otherwise tighten with VPC/private networking when possible.
   - VPS: whitelist static VPS IP.
4. Enable backups and point-in-time recovery.
5. Set alerts (CPU, memory, connections, slow queries).

---

## 4) HTTPS configuration

## Render

- Render terminates TLS automatically for `*.onrender.com` and custom domains.
- Enforce HTTPS redirect at edge and in app platform settings.
- Set `TRUST_PROXY=1` so Express can correctly detect protocol/IP behind proxy.

## VPS (NGINX + Certbot)

1. Install NGINX and Certbot.
2. Create reverse proxy from `443 -> 127.0.0.1:8084`.
3. Issue cert:
   - `sudo certbot --nginx -d api.fiber.yourdomain.com`
4. Enable HSTS and modern TLS ciphers in NGINX.
5. Auto-renew certificates (`systemctl status certbot.timer`).

---

## 5) API hardening (implemented in codebase)

- Helmet headers enabled
- Strict CORS allowlist via `CORS_ORIGIN`
- Global rate limiting + stronger auth endpoint throttling
- HTTP parameter pollution protection (`hpp`)
- JWT auth middleware for protected routes (`API_REQUIRE_AUTH`)
- Production-safe error responses (no stack leakage)
- Reduced request body size (`REQUEST_BODY_LIMIT`)

Additional hardening to add next:

- Refresh token rotation + token revocation list
- Role-based route authorization middleware
- Audit log for privileged operations
- WAF (Cloudflare/AWS WAF) for bot/anomaly filtering

---

## 6) Logging and monitoring

Minimum production baseline:

- Access logs: `morgan('combined')`
- Error logs: stderr collection by platform
- Centralized logs: Datadog/ELK/Grafana Loki
- Uptime checks: `/api/health` every 30-60s
- APM: New Relic/Datadog/OpenTelemetry
- Alerts: 5xx rate, P95 latency, memory usage, restart count

Suggested SLO starter:

- Availability: 99.9%
- P95 latency: < 400 ms
- Error budget alert when 5xx > 1% for 5 minutes

---

## 7) Performance optimization

- Enable compression (already enabled)
- Keep API stateless for horizontal scaling
- Tune Mongo pool with env vars based on instance size
- Add Mongo indexes for frequent filters (`serviceId`, `status`, `idImmeuble`, `email`)
- Use pagination everywhere for list endpoints
- Move media uploads to object storage + CDN
- Add Node cluster mode only if CPU-bound (otherwise scale replicas)

---

## 8) Deployment steps

## A) Render deployment

1. Push repository to GitHub.
2. Create Render Web Service:
   - Root directory: `backendfiber`
   - Build command: `npm ci`
   - Start command: `npm start`
3. Set all production env vars from `.env.production.example`.
4. Add health check path: `/api/health`.
5. Add custom domain + TLS.
6. Deploy and verify:
   - `GET /api/health`
   - `POST /api/auth/login`
   - Authenticated call to protected endpoint.

## B) VPS deployment (Ubuntu + PM2 + NGINX)

1. Install runtime:
   - Node.js 20, npm, git, NGINX.
2. Pull code and install:
   - `cd backendfiber && npm ci`
3. Configure `.env` with production values.
4. Start with PM2:
   - `pm2 start server.js --name fiber-api`
   - `pm2 save && pm2 startup`
5. Configure NGINX reverse proxy + TLS.
6. Lock server:
   - UFW allow `22,80,443`; deny direct app port.
7. Set backups + monitoring.

---

## 9) Security checklist (go-live)

- [ ] No default admin credentials in production
- [ ] `JWT_SECRET` strong and unique
- [ ] `API_REQUIRE_AUTH=true`
- [ ] Strict `CORS_ORIGIN` (no `*`)
- [ ] Rate limiting enabled and tested
- [ ] HTTPS enforced end-to-end
- [ ] MongoDB IP allowlist + least privilege user
- [ ] Backups + restore drill validated
- [ ] Logs centralized and alerts configured
- [ ] Dependency audit passed (`npm audit --omit=dev`)
- [ ] Secrets rotated and documented

