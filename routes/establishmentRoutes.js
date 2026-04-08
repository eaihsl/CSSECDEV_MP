const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Establishment = require("../models/Establishment");
const Review = require("../models/Review");
const Comment = require("../models/Comment"); // need to load the comments
const { v4: uuidv4 } = require("uuid"); // Import uuid for unique filenames

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/establishmentPictures/";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`; // Use uuid for unique filename
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Only .jpg files are allowed!"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
});

// GET Establishment by ID
router.get("/:id", async (req, res) => {
  try {
    // Fetch establishment details by ID
    const establishment = await Establishment.findById(req.params.id)  .populate("owner", "username")
    .lean();
    if (!establishment) return res.status(404).json({ message: "Establishment not found" });

    // Get reviews for this establishment
    const reviews = await Review.find({ establishmentId: req.params.id }).populate("userId", "username").lean();
    
    // Modify reviews to include likes and dislikes count
    const modifiedReviews = reviews.map(review => ({
      ...review,
      likesCount: review.likes.length, // Count likes
      dislikesCount: review.dislikes.length, // Count dislikes
      stars: '★'.repeat(review.rating), // Stars for rating
      images: review.images.map(image => ({
        src: image,
        reviewId: review._id, // Add the review ID for unique modal ID
      }))
    })); 

    modifiedReviews.sort((A, B) => {
      const scoreA = A.likesCount - A.dislikesCount;
      const scoreB = B.likesCount - B.dislikesCount;

      if (scoreA != scoreB) {
        return scoreB - scoreA;
      }

      return B.likesCount - A.likesCount;
    });

    // Render the establishment page with data
    // res.render("establishment", { establishment, reviews: modifiedReviews });

    res.render("establishment", {
      establishment,
      reviews: modifiedReviews,
      user: req.session.user,
      isBusiness: req.session.user && req.session.user.role === "business"
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET Reviews based on a search query
router.get("/:id/results", async (req, res) => {
  try {
    const establishment = await Establishment.findById(req.params.id).lean();
    if (!establishment) return res.status(404).json({ message: "Establishment not found" });

    const searchString = req.query.reviewSearch || '';

    const queryFilter = {
      ...(searchString != '' && { reviewText : { $regex : searchString, $options : 'i' } }),
      establishmentId: req.params.id
    };

    const reviews = await Review.find(queryFilter).populate("userId", "username").lean();
    
    const modifiedReviews = reviews.map(review => ({
      ...review,
      likesCount: review.likes.length, // Count likes
      dislikesCount: review.dislikes.length, // Count dislikes
      stars: '★'.repeat(review.rating), // Stars for rating
      images: review.images.map(image => ({
        src: image,
        reviewId: review._id, // Add the review ID for unique modal ID
      }))
    }));

    modifiedReviews.sort((A, B) => {
      const scoreA = A.likesCount - A.dislikesCount;
      const scoreB = B.likesCount - B.dislikesCount;

      if (scoreA != scoreB) {
        return scoreB - scoreA;
      }

      return B.likesCount - A.likesCount;
    });

    res.render("establishment", {
      establishment,
      reviews: modifiedReviews,
      user: req.session.user,
      isBusiness: req.session.user && req.session.user.role === "business",
      searchReview : searchString,
      isSearching : true
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET Comments for a Review
router.get("/:establishmentId/reviews/:reviewId", async (req, res) => {
  try {
    // Fetch review by ID and populate comments
    const review = await Review.findById(req.params.reviewId)
      .populate({
        path: "comments",
        populate: { path: "userId", select: "username" }
      })
      .lean();

    if (!review) return res.status(404).json({ message: "Review not found" });

    // Respond with comments for the review
    res.json({ comments: review.comments });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

//create Establishment
/*
router.post("/:id", async (req, res) => {
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const establishment = await Establishment.findById(id);

    if (!establishment) {
      return res.status(404).json({ message: "Establishment not found" });
    }

    if (establishment.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to modify this establishment" });
    }

    const updatedEstablishment = await Establishment.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    res.json({ message: "Establishment updated successfully", establishment: updatedEstablishment });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const establishment = await Establishment.findById(id);

    if (!establishment) {
      return res.status(404).json({ message: "Establishment not found" });
    }

    if (establishment.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to delete this establishment" });
    }

    await establishment.deleteOne();

    res.json({ message: "Establishment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
 */

module.exports = router;
