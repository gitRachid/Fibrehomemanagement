# FiberHomeManage

Mobile-first field management app for fiber optic building infrastructure (FTTH). Expo React Native frontend + Express.js backend + MongoDB.

## Cursor Cloud specific instructions

### Architecture

| Service | Tech | Port | Dev command |
|---------|------|------|-------------|
| **Backend API** | Express.js + Mongoose | 8084 | `cd backendfiber && npm run dev` |
| **Expo Frontend** | Expo SDK 55 + React Native | 8081 | `EXPO_PUBLIC_API_URL=http://localhost:8084/api npx expo start --web --port 8081` |
| **MongoDB** | MongoDB 7.0 | 27017 | `mongod --dbpath /data/db --fork --logpath /var/log/mongod.log` |

Redis, MinIO, Nginx, and the worker process are production-only and not needed for development.

### Startup sequence

1. Start MongoDB: `mongod --dbpath /data/db --fork --logpath /var/log/mongod.log`
2. Start backend: `cd backendfiber && npm run dev` (requires `.env` — copy from `.env.example` if missing)
3. Start frontend: `cd /workspace && EXPO_PUBLIC_API_URL=http://localhost:8084/api npx expo start --web --port 8081`

### Key gotchas

- **Backend .env**: Must exist at `backendfiber/.env`. Copy from `backendfiber/.env.example`. Auth is disabled by default (`API_REQUIRE_AUTH=false`).
- **SecureStore on web**: `expo-secure-store` throws errors on web (login/register). This is expected — SecureStore is a native-only API. The app's core UI still renders.
- **Lint / typecheck**: `npm run lint` in the root runs `tsc --noEmit` (same as `npm test` and `npm run typecheck`).
- **Backend tests**: `cd backendfiber && npm test` runs Jest with `--passWithNoTests` (no test files exist yet).
- **nvm**: Node.js is managed via nvm at `/home/ubuntu/.nvm/nvm.sh`. Source it before running node/npm commands: `source /home/ubuntu/.nvm/nvm.sh`.
- **Package manager**: Both frontend and backend use `npm` (lockfiles are `package-lock.json`).
