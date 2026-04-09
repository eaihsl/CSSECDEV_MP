const { logSecurityEvent } = require("../utils/securityLogger");
const Review = require("../models/Review");
const Comment = require("../models/Comment");
const Establishment = require("../models/Establishment");

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

// 2.2.1: Single site-wide component for authentication checks
const ensureLoggedIn = (req, res, next) => {
  if (req.session?.user) {
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_AUTHENTICATION",
      outcome: "SUCCESS",
      message: "Authenticated access granted.",
      req
    });
    return next();
  }

  logSecurityEvent({
    eventType: "ACCESS_CONTROL_AUTHENTICATION",
    outcome: "FAILURE",
    message: "Unauthenticated access attempt blocked.",
    req,
    metadata: { actionPath: req.originalUrl }
  });

  // 2.2.2: Fail securely with a minimal unauthorized response
  return res.status(401).json({ message: "Unauthorized. Please log in." });
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

// 2.2.1: Centralized role-based authorization guard
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.session?.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_ROLE",
        outcome: "FAILURE",
        message: "Role check blocked: no active session.",
        req,
        metadata: { allowedRoles }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    if (allowedRoles.includes(req.session.user.role)) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_ROLE",
        outcome: "SUCCESS",
        message: "Role check passed.",
        req,
        metadata: { allowedRoles, actualRole: req.session.user.role }
      });
      return next();
    }

    // 2.2.2: Fail securely on role mismatch
    logSecurityEvent({
      eventType: "ACCESS_CONTROL_ROLE",
      outcome: "FAILURE",
      message: "Role check denied access.",
      req,
      metadata: { allowedRoles, actualRole: req.session.user.role }
    });
    return res.status(403).json({ message: "Forbidden." });
  };
};

// 2.2.1: Centralized ownership guard for review modifications
const requireReviewOwner = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_OWNER",
        outcome: "FAILURE",
        message: "Review owner check blocked: no active session.",
        req,
        metadata: { reviewId: req.params.reviewId }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const review = await Review.findById(req.params.reviewId).lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(review.userId) !== String(req.session.user._id)) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_OWNER",
        outcome: "FAILURE",
        message: "Review owner check denied access.",
        req,
        metadata: {
          reviewId: req.params.reviewId,
          ownerUserId: String(review.userId),
          actorUserId: String(req.session.user._id)
        }
      });
      return res.status(403).json({ message: "Forbidden." });
    }

    return next();
  } catch (error) {
    console.error("Review owner authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 2.2.1: Centralized ownership guard for comment deletion
const requireCommentOwner = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_COMMENT_OWNER",
        outcome: "FAILURE",
        message: "Comment owner check blocked: no active session.",
        req,
        metadata: { commentId: req.params.commentId }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const comment = await Comment.findById(req.params.commentId).lean();
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (String(comment.userId) !== String(req.session.user._id)) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_COMMENT_OWNER",
        outcome: "FAILURE",
        message: "Comment owner check denied access.",
        req,
        metadata: {
          commentId: req.params.commentId,
          ownerUserId: String(comment.userId),
          actorUserId: String(req.session.user._id)
        }
      });
      return res.status(403).json({ message: "Forbidden." });
    }

    return next();
  } catch (error) {
    console.error("Comment owner authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 2.2.1: Centralized ownership guard for establishment operations
const requireEstablishmentOwner = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_ESTABLISHMENT_OWNER",
        outcome: "FAILURE",
        message: "Establishment owner check blocked: no active session.",
        req,
        metadata: { gymId: req.params.gymId, establishmentId: req.params.establishmentId }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const establishmentId = req.params.gymId || req.params.establishmentId;
    const establishment = await Establishment.findById(establishmentId).lean();

    if (!establishment) {
      return res.status(404).json({ message: "Establishment not found." });
    }

    if (String(establishment.owner) !== String(req.session.user._id)) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_ESTABLISHMENT_OWNER",
        outcome: "FAILURE",
        message: "Establishment owner check denied access.",
        req,
        metadata: {
          establishmentId,
          ownerUserId: String(establishment.owner),
          actorUserId: String(req.session.user._id)
        }
      });
      return res.status(403).json({ message: "Forbidden." });
    }

    return next();
  } catch (error) {
    console.error("Establishment owner authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// 2.2.3: Business rule guard to block self-votes on reviews
const requireNotSelfReviewVote = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_VOTE",
        outcome: "FAILURE",
        message: "Review vote blocked: no active session.",
        req,
        metadata: { reviewId: req.params.reviewId }
      });
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const review = await Review.findById(req.params.reviewId).lean();
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    if (String(review.userId) === String(req.session.user._id)) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_REVIEW_VOTE",
        outcome: "FAILURE",
        message: "Review vote blocked: self-voting is not allowed.",
        req,
        metadata: { reviewId: req.params.reviewId, actorUserId: String(req.session.user._id) }
      });
      return res.status(403).json({ message: "Forbidden." });
    }

    return next();
  } catch (error) {
    console.error("Review vote authorization error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  isAuthenticated,
  isAdmin,
  ensureLoggedIn,
  requireRole,
  requireReviewOwner,
  requireCommentOwner,
  requireEstablishmentOwner,
  requireNotSelfReviewVote
};