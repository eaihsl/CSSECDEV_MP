const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewText: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  establishmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment', required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  edited: { type: Boolean, default: false },
  images: [{ type: String }]
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
