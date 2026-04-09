const { logSecurityEvent } = require("../utils/securityLogger");
const Review = require("../models/Review");

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

// [2.2.1] Site-wide authorization component: enforce business role for protected business actions.
const requireBusinessRole = (req, res, next) => {
  if (!req.session.user) {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_ROLE",
      outcome: "FAILURE",
      message: "Role-protected action blocked: no active session.",
      req,
      metadata: { requiredRole: "business" }
    });
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }

  if (req.session.user.role === "business") {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_ROLE",
      outcome: "SUCCESS",
      message: "Role-protected action allowed for business user.",
      req,
      metadata: { requiredRole: "business", actualRole: req.session.user.role }
    });
    return next();
  }

  logSecurityEvent({
    eventType: "ACCESS_CONTROL_ROLE",
    outcome: "FAILURE",
    message: "Role-protected action denied: insufficient role.",
    req,
    metadata: { requiredRole: "business", actualRole: req.session.user.role }
  });
  return res.status(403).json({ message: "Forbidden. Business users only." });
};

// [2.2.1] Site-wide authorization component: prevent users from voting on their own reviews.
const preventSelfReviewVote = async (req, res, next) => {
  try {
    if (!req.session.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_VOTE",
        outcome: "FAILURE",
        message: "Review vote blocked: no active session.",
        req,
        metadata: { reviewId: req.params.reviewId }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const review = await Review.findById(req.params.reviewId).select("userId");
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (review.userId.toString() === req.session.user._id.toString()) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_VOTE",
        outcome: "FAILURE",
        message: "Review vote blocked: self-voting is not allowed.",
        req,
        metadata: { reviewId: req.params.reviewId, actorUserId: req.session.user._id }
      });
      return res.status(403).json({ message: "Forbidden. You cannot vote on your own review." });
    }

    logSecurityEvent({
      eventType: "ACCESS_CONTROL_REVIEW_VOTE",
      outcome: "SUCCESS",
      message: "Review vote authorization check passed.",
      req,
      metadata: { reviewId: req.params.reviewId, actorUserId: req.session.user._id }
    });
    return next();
  } catch (error) {
    console.error("Review vote authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { isAuthenticated, isAdmin, requireBusinessRole, preventSelfReviewVote };