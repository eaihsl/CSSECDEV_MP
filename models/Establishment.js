const mongoose = require('mongoose');

const allowedAmenities = [
  "Showers",
  "Parking",
  "Swimming Pool",
  "Lockers",
  "Sauna",
  "Spa Services",
  "Free WiFi Access",
  "Nutrition Bar",
  "Basketball Court",
  "TV Screens on Equipment"
];

const allowedLocations = [
  "NCR West",
  "NCR East",
  "NCR North",
  "NCR South",
  "Cavite",
  "Laguna",
  "Rizal",
  "Bulacan"
];

const establishmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amenities: { type: [String], enum: allowedAmenities},
  location: { type: String, enum: allowedLocations },
  address: { type: String},
  shortDescription: { type: String },
  contactNumber: { type: String},
  rating: { type: Number, min: 0, max: 5 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: { type: String },
}, { timestamps: true });

const Establishment = mongoose.model('Establishment', establishmentSchema);
module.exports = Establishment;
