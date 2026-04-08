const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Review = require("../models/Review");

// Middleware to ensure user is logged in
function ensureLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ message: 'You must be logged in.' });
}

// Route: POST /comments/:reviewId/create
router.post('/:reviewId/create', ensureLoggedIn, async (req, res) => {
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
router.delete('/:commentId/delete', ensureLoggedIn, async (req, res) => {
  const { commentId } = req.params;

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    // Only allow the user who posted the comment to delete it
    if (comment.userId.toString() !== req.session.user._id) {
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