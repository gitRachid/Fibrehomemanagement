/*
 * Worker process placeholder for async jobs (imports, media processing, etc.).
 * Keeps the deployment topology ready for queue-based background tasks.
 */
require('dotenv').config();

const intervalMs = Number(process.env.WORKER_HEARTBEAT_MS || 30000);

console.log('[worker] started');
console.log('[worker] heartbeat interval:', intervalMs, 'ms');

setInterval(() => {
  console.log('[worker] alive at', new Date().toISOString());
}, intervalMs);
