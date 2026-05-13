/*
 * Worker process placeholder for async jobs (imports, media processing, etc.).
 * Keeps the deployment topology ready for queue-based background tasks.
 */
require('dotenv').config();

const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS || 30000);

setInterval(() => {}, intervalMs);
