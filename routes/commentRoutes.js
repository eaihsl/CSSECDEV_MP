const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require("../models/Review");
const { logSecurityEvent } = require("../utils/securityLogger");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Middleware to ensure user is logged in
function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  logSecurityEvent({
    eventType: "ACCESS_CONTROL_COMMENT_ACTION",
    outcome: "FAILURE",
    message: "Comment action blocked: no active session.",
    req,
    metadata: { actionPath: req.originalUrl }
  });

  return res.status(401).json({ message: 'You must be logged in.' });
}

// Route: POST /comments/:reviewId/create
// [2.2.1] Additive site-wide authorization check for comment creation.
router.post('/:reviewId/create', ensureLoggedIn, isAuthenticated, async (req, res) => {
  const { reviewId } = req.params;
  const { commentText } = req.body;

  try {
    // [2.3.1] Input validation: reject non-string, empty, and overlong comments.
    if (typeof commentText !== "string") {
      logSecurityEvent({
        eventType: "INPUT_VALIDATION",
        outcome: "FAILURE",
        message: "Comment creation rejected: comment text must be a string.",
        req,
        metadata: { reviewId }
      });
      return res.status(400).json({ message: "Comment text must be a string." });
    }

    const trimmedCommentText = commentText.trim();
    if (!trimmedCommentText || trimmedCommentText.length > 2000) {
      logSecurityEvent({
        eventType: "INPUT_VALIDATION",
        outcome: "FAILURE",
        message: "Comment creation rejected: comment text length is invalid.",
        req,
        metadata: { reviewId, length: trimmedCommentText.length }
      });
      return res.status(400).json({ message: "Comment text must be between 1 and 2000 characters." });
    }

    const comment = new Comment({
      reviewId,
      userId: req.session.user._id,
      commentText
    });

    await comment.save();

    await Review.findByIdAndUpdate(reviewId, {
        $push: { comments: comment._id }
    });

    res.status(201).json({ message: 'Comment posted successfully', comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to post comment' });
  }
});

// DELETE /comments/:commentId/delete
// [2.2.1] Additive site-wide authorization check for comment deletion.
router.delete('/:commentId/delete', ensureLoggedIn, isAuthenticated, async (req, res) => {
  const { commentId } = req.params;

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    // Only allow the user who posted the comment to delete it
    if (comment.userId.toString() !== req.session.user._id) {
      logSecurityEvent({
        eventType: "ACCESS_CONTROL_COMMENT_ACTION",
        outcome: "FAILURE",
        message: "Comment delete blocked: user is not the owner.",
        req,
        metadata: {
          commentId,
          ownerUserId: comment.userId.toString(),
          actorUserId: req.session.user._id
        }
      });
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Remove comment from Review.comments[]
    await Review.findByIdAndUpdate(comment.reviewId, {
      $pull: { comments: comment._id }
    });

    await Comment.findByIdAndDelete(commentId);

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// ✅ Export both the router and the middleware properly
module.exports = {
  router,
  ensureLoggedIn
};