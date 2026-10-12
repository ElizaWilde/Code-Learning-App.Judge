"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimit = createRateLimit;
// Fixed-window in-memory limiter for the current single-process backend. When
// the API becomes multi-replica this store must move to Redis or equivalent.
function createRateLimit(options) {
    const entries = new Map();
    let nextPruneAt = Date.now() + options.windowMs;
    return (req, res, next) => {
        const now = Date.now();
        if (now >= nextPruneAt) {
            for (const [key, entry] of entries) {
                if (entry.resetAt <= now) {
                    entries.delete(key);
                }
            }
            nextPruneAt = now + options.windowMs;
        }
        const key = options.keyGenerator(req);
        const existing = entries.get(key);
        const entry = !existing || existing.resetAt <= now
            ? { count: 0, resetAt: now + options.windowMs }
            : existing;
        entry.count += 1;
        entries.set(key, entry);
        const remaining = Math.max(0, options.maxRequests - entry.count);
        const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        res.setHeader("RateLimit-Limit", String(options.maxRequests));
        res.setHeader("RateLimit-Remaining", String(remaining));
        res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
        if (entry.count > options.maxRequests) {
            res.setHeader("Retry-After", String(retryAfterSeconds));
            res.status(429).json({
                message: "judge request rate limit exceeded",
                retryAfterSeconds
            });
            return;
        }
        next();
    };
}
