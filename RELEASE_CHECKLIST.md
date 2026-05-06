# FiberHomeManage release checklist

## 1) Environment
- [ ] Frontend `.env` configured with `EXPO_PUBLIC_API_URL`
- [ ] Backend `.env` configured with `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] Backend reachable from test devices (phone/emulator/web)

## 2) Quality gates
- [ ] Frontend: `npm run typecheck`
- [ ] Frontend: `npm run lint`
- [ ] Backend: `npm test`
- [ ] Backend: `npm run smoke`

## 3) Core flows
- [ ] Login works with backend credentials
- [ ] Building list loads by service
- [ ] Assignment creation works (technician selection -> persisted)
- [ ] Photo upload works from mobile and web
- [ ] Offline change creates pending sync and sync succeeds when back online

## 4) Final safety
- [ ] `.env` files not tracked by git
- [ ] No legacy `DEL*` files remaining
- [ ] Health endpoint responds: `/api/health`
