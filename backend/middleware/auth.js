const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function isAdminEmail(email) {
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(email || "").toLowerCase());
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email, isAdmin: isAdminEmail(payload.email) };
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required." });
    next();
  });
}

module.exports = { requireAuth, requireAdmin, isAdminEmail, JWT_SECRET };
