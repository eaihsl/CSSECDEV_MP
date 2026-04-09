const fs = require("fs");
const path = require("path");

const isSecurityLoggingEnabled = process.env.SECURITY_LOGGING_ENABLED !== "false";
const securityLogPath = process.env.SECURITY_LOG_PATH || path.join(__dirname, "..", "logs", "security-events.log");

const redactedKeys = new Set([
  "password",
  "newPassword",
  "currentPassword",
  "securityAnswer",
  "token",
  "secret",
  "session"
]);

function sanitizeForLogging(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeForLogging);
  }

  if (value && typeof value === "object") {
    const safeObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (redactedKeys.has(key)) {
        safeObject[key] = "[REDACTED]";
        continue;
      }
      safeObject[key] = sanitizeForLogging(entry);
    }
    return safeObject;
  }

  return value;
}

function buildRequestContext(req) {
  if (!req) {
    return null;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const clientIp = typeof rawIp === "string"
    ? rawIp.split(",")[0].trim()
    : (req.ip || req.socket?.remoteAddress || null);

  return {
    method: req.method,
    path: req.originalUrl || req.url,
    ip: clientIp,
    userAgent: req.headers["user-agent"] || null,
    userId: req.session?.user?._id || null,
    role: req.session?.user?.role || null
  };
}

function logSecurityEvent({ eventType, outcome, message, req, metadata = {} }) {
  if (!isSecurityLoggingEnabled) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    outcome,
    message,
    request: buildRequestContext(req),
    metadata: sanitizeForLogging(metadata)
  };

  try {
    fs.mkdirSync(path.dirname(securityLogPath), { recursive: true });
    fs.appendFileSync(securityLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (writeError) {
    console.error("Security log write failed:", writeError.message);
  }

  if (outcome === "FAILURE") {
    console.warn(`[SECURITY][${eventType}][${outcome}] ${message}`);
  } else {
    console.log(`[SECURITY][${eventType}][${outcome}] ${message}`);
  }
}

module.exports = {
  logSecurityEvent
};
