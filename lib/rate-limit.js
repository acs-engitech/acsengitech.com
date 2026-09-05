// ponytail: single in-memory bucket, resets on cold start. Fine for a serverless function with
// low submission volume; swap for a shared store (Redis/Neon) if abuse becomes a real problem.
const buckets = new Map();

function checkRateLimit(key, max = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  buckets.set(key, entry);
  return entry.count <= max;
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

module.exports = { checkRateLimit, clientIp };
