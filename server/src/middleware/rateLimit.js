const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 120, key } = {}) {
  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '') || req.ip || req.socket?.remoteAddress || 'unknown';
    const bucketKey = key ? key(req) || ip : ip;
    const now = Date.now();
    const recent = (buckets.get(bucketKey) || []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ success: false, data: null, message: 'Too many requests' });
      return;
    }
    recent.push(now);
    buckets.set(bucketKey, recent);
    next();
  };
}
