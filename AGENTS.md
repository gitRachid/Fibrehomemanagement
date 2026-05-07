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
- **Lint / typecheck**: `npm run lint` in the root runs `tsc --noEmit` (same as `npm test` and `npm run typecheck`).
- **Backend tests**: `cd backendfiber && npm test` runs Jest with `--passWithNoTests` (no test files exist yet).
- **nvm**: Node.js is managed via nvm at `/home/ubuntu/.nvm/nvm.sh`. Source it before running node/npm commands: `source /home/ubuntu/.nvm/nvm.sh`.
- **Package manager**: Both frontend and backend use `npm` (lockfiles are `package-lock.json`).

### API response contract

All backend routes return `{ success: boolean, data: T, count?: number, message?: string }`. The `apiClient` in `src/api/client.ts` returns this envelope as-is. Use the `unwrapData<T>()` and `unwrapList<T>()` helpers (exported from `@/api`) instead of manually accessing `response.data` in hooks and services.

### Sync strategy

The canonical offline sync path is **queue-based** via `QueueManager` + `SyncService` (in `src/services/`). CRUD operations are enqueued when offline and replayed entity-by-entity when connectivity returns. The legacy `POST /api/sync` batch endpoint in the backend exists but is not the primary path for the mobile app.
