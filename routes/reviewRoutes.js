const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const Establishment = require("../models/Establishment");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require('uuid');
const fs = require("fs");
const Comment = require('../models/Comment');
const { logSecurityEvent } = require("../utils/securityLogger");
const {
  ensureLoggedIn,
  requireRole,
  requireReviewOwner,
  requireNotSelfReviewVote
} = require("../middlewares/authMiddleware");

const dotenv = require("dotenv");
dotenv.config();

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/review_pictures/"); // Store images in the review_pictures folder
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`; // Assign unique filename
    cb(null, uniqueFilename);
  }
});

// Multer middleware for review images
const uploadReviewImages = multer({
  storage: reviewStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg|jpeg$/; // Allow jpg
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Only .jpg files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Limit file size to 10MB
});

router.post(
  "/:establishmentId/create",
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can create reviews
  requireRole(["people"]),
  uploadReviewImages.array('reviewImages', 6),
  async (req, res) => {
  try {
    const { reviewText, rating } = req.body;
    const { establishmentId } = req.params;

    // Handle file uploads
    const reviewImages = req.files;  // This will hold the uploaded image files

    if (!reviewText) {
      logSecurityEvent({
        eventType: "INPUT_VALIDATION",
        outcome: "FAILURE",
        message: "Review creation rejected: review text is required.",
        req,
        metadata: { establishmentId }
      });
      return res.status(400).json({ message: "Review text is required" });
    }

    const establishment = await Establishment.findById(establishmentId);
    if (!establishment) return res.status(404).json({ message: "Establishment not found" });

    const existingReview = await Review.findOne({
      userId: req.session.user._id,
      establishmentId
    });

    if (existingReview) {
      logSecurityEvent({
        eventType: "INPUT_VALIDATION",
        outcome: "FAILURE",
        message: "Review creation rejected: duplicate review for establishment.",
        req,
        metadata: { establishmentId, userId: req.session.user._id }
      });
      return res.status(400).json({ message: "You have already posted a review for this establishment" });
    }

    // Create a new review
    const newReview = new Review({
      userId: req.session.user._id,
      establishmentId,
      reviewText,
      rating: parseInt(rating),
      likes: [],
      dislikes: [],
      createdAt: new Date(),
      images: reviewImages ? reviewImages.map(file => file.filename) : [] // Store filenames of the uploaded images
    });

    await newReview.save();

    // Update the establishment's rating
    await updateEstablishmentRating(establishmentId);

    res.status(201).json({ message: "Review posted successfully!", review: newReview });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
    console.error("Review save failed:", err);
  }
});

async function updateEstablishmentRating(establishmentId) {
  const reviews = await Review.find({ establishmentId });
  if (reviews.length === 0) {
    await Establishment.findByIdAndUpdate(establishmentId, { rating: 0 });
    return;
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const average = total / reviews.length;

  await Establishment.findByIdAndUpdate(establishmentId, {
    rating: average.toFixed(1)
  });
}
//edit review
router.put(
  "/:reviewId/edit",
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can edit reviews
  requireRole(["people"]),
  // 2.2.3: Enforce owner-only review edits
  requireReviewOwner,
  async (req, res) => {
  try {
    const { reviewText, rating } = req.body;
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.reviewText = reviewText;
    review.rating = parseInt(rating);
    review.edited = true;

    await review.save();
    await updateEstablishmentRating(review.establishmentId);

    res.status(200).json({ message: "Review updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// delete review
router.delete(
  "/:reviewId",
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can delete reviews
  requireRole(["people"]),
  // 2.2.3: Enforce owner-only review deletion
  requireReviewOwner,
  async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });

    review.images.forEach((img) => {
      const filePath = path.join('public/review_pictures', img);
      fs.unlinkSync(filePath);
    });

    await Comment.deleteMany({ _id: { $in: review.comments } });
    await Review.findByIdAndDelete(reviewId);
    await updateEstablishmentRating(review.establishmentId);
    res.status(200).json({ message: "Review deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/:reviewId/vote",
  // 2.2.1: Single site-wide authorization component
  ensureLoggedIn,
  // 2.2.3: Enforce business rule that only people accounts can vote on reviews
  requireRole(["people"]),
  // 2.2.3: Enforce no self-voting business rule
  requireNotSelfReviewVote,
  async (req, res) => {
  const { reviewId } = req.params;
  const { type } = req.body;
  const userId = req.session.user._id;

  const review = await Review.findById(reviewId);
  if (!review) return res.status(404).json({ message: "Review not found." });

  // First, remove from both
  review.likes.pull(userId);
  review.dislikes.pull(userId);

  // If the user wants to remove their reaction entirely, just save
  if (type === "remove") {
    await review.save();
    return res.status(200).json({
      updatedCounts: {
        likesCount: review.likes.length,
        dislikesCount: review.dislikes.length
      }
    });
  }

  // Otherwise, add the new vote
  if (type === "like") review.likes.push(userId);
  else if (type === "dislike") review.dislikes.push(userId);

  await review.save();

  res.status(200).json({
    updatedCounts: {
      likesCount: review.likes.length,
      dislikesCount: review.dislikes.length
    }
  });
});

module.exports = router;