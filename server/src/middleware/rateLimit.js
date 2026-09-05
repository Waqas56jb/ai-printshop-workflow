const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 120 } = {}) {
  return (req, res, next) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '') || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (buckets.get(ip) || []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ success: false, data: null, message: 'Too many requests' });
      return;
    }
    recent.push(now);
    buckets.set(ip, recent);
    next();
  };
}
