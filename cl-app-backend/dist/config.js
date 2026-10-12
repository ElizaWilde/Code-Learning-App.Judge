"use strict";
// Centralized runtime configuration. Security-sensitive values deliberately have
// no development fallback so a misconfigured deployment fails before listening.
Object.defineProperty(exports, "__esModule", { value: true });
exports.JUDGE_RATE_LIMIT_MAX_REQUESTS = exports.JUDGE_RATE_LIMIT_WINDOW_MS = exports.JUDGE_MAX_SOURCE_BYTES = exports.JSON_BODY_LIMIT_BYTES = exports.ADMIN_PASSWORD = exports.ADMIN_USERNAME = exports.JWT_SECRET = void 0;
function requireSecret(name, minimumLength) {
    const value = process.env[name];
    if (!value || value.trim().length < minimumLength) {
        throw new Error(`${name} is required and must be at least ${minimumLength} characters.`);
    }
    return value;
}
function positiveInteger(name, fallback, minimum, maximum) {
    const raw = process.env[name]?.trim();
    if (!raw) {
        return fallback;
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value;
}
exports.JWT_SECRET = requireSecret("CODEBOX_JWT_SECRET", 32);
exports.ADMIN_USERNAME = process.env.CODEBOX_ADMIN_USERNAME?.trim() || "admin";
exports.ADMIN_PASSWORD = requireSecret("CODEBOX_ADMIN_PASSWORD", 12);
exports.JSON_BODY_LIMIT_BYTES = positiveInteger("CODEBOX_JSON_BODY_LIMIT_BYTES", 64 * 1024, 1024, 1024 * 1024);
exports.JUDGE_MAX_SOURCE_BYTES = positiveInteger("CODEBOX_JUDGE_MAX_SOURCE_BYTES", 50 * 1024, 1024, 512 * 1024);
exports.JUDGE_RATE_LIMIT_WINDOW_MS = positiveInteger("CODEBOX_JUDGE_RATE_LIMIT_WINDOW_MS", 60_000, 1000, 60 * 60 * 1000);
exports.JUDGE_RATE_LIMIT_MAX_REQUESTS = positiveInteger("CODEBOX_JUDGE_RATE_LIMIT_MAX_REQUESTS", 10, 1, 10_000);
