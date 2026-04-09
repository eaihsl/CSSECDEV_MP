const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require("../models/Review");
const {
  ensureLoggedIn,
  requireRole,
  requireCommentOwner
} = require("../middlewares/authMiddleware");

// Route: POST /comments/:reviewId/create
router.post(
  '/:reviewId/create',
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can create comments
  requireRole(['people']),
  async (req, res) => {
  const { reviewId } = req.params;
  const { commentText } = req.body;

  try {
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
router.delete(
  '/:commentId/delete',
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can delete comments
  requireRole(['people']),
  // 2.2.3: Enforce owner-only comment deletion
  requireCommentOwner,
  async (req, res) => {
  const { commentId } = req.params;

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

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

module.exports = {
  router
};