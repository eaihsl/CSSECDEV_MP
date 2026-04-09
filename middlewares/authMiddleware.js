const { logSecurityEvent } = require("../utils/securityLogger");

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_AUTHENTICATION",
      outcome: "SUCCESS",
      message: "Authenticated access granted.",
      req
    });
    next();
  } else {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_AUTHENTICATION",
      outcome: "FAILURE",
      message: "Unauthenticated access attempt blocked.",
      req
    });
    res.status(401).json({ message: "Unauthorized. Please log in." });
  }
};

// Middleware to check if the logged-in user is an admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_ADMIN",
      outcome: "SUCCESS",
      message: "Admin access granted.",
      req,
      metadata: { requiredRole: "admin" }
    });
    next();
  } else {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_ADMIN",
      outcome: "FAILURE",
      message: "Admin access denied.",
      req,
      metadata: {
        requiredRole: "admin",
        actualRole: req.session?.user?.role || "guest"
      }
    });
    res.status(403).json({ message: "Forbidden. Admins only." });
  }
};

module.exports = { isAuthenticated, isAdmin };