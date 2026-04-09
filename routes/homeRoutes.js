const express = require("express");
const router = express.Router();
const Establishment = require("../models/Establishment");
const Review = require("../models/Review");

const MAX_SEARCH_LENGTH = 500;
const MAX_FILTER_ARRAY_SIZE = 20;
const ALLOWED_AMENITIES = [
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
const ALLOWED_LOCATIONS = [
    "NCR",
    "Cavite",
    "Laguna",
    "Rizal",
    "Bulacan"
];
const UNSAFE_REGEX_PATTERN = /[.*+?^${}()|[\]\\]/;

// Get all establishments
router.get("/", async (req, res, next) => {
    try {
        const establishments = await Establishment.find().lean();

        for(const establishment of establishments) {
            try {
              const reviews = await Review.find({ establishmentId: establishment._id }).lean();
              establishment.reviewsCount = reviews.length;
            } catch (error) {
              console.error('Something went wrong when trying to fetch number of reviews:', error);
            }
        }

        establishments.sort((A, B) => {
            return B.rating - A.rating; // default is highest to lowest rating
        });

        res.render("home", { establishments, user: req.session.user || null, searchName : "", searchDesc : "", amenities : [], locations : [], ratings : [] });
    } catch (error) {
        next(error);
    }
});

// Search results
router.get("/results", async (req, res, next) => {
    const searchName = req.query.nameSearch || '';
    const searchDesc= req.query.descSearch || '';
    // Hope you like ternary operators
    // Ensures that selectedAmenities and selectedLocations is always an array
    const selectedAmenities = Array.isArray(req.query.amenities) ? req.query.amenities : req.query.amenities ? [req.query.amenities] : [];
    const selectedLocations = Array.isArray(req.query.regions) ? req.query.regions : req.query.regions ? [req.query.regions] : [];
    const selectedRatings = Array.isArray(req.query.ratings) ? req.query.ratings.map(Number) : req.query.ratings ? [Number(req.query.ratings)] : [];
    const sortBy = Number(req.query.sortby) || 1;

    // [2.3.2] Range validation: sort option must be in range 1-5.
    if (sortBy < 1 || sortBy > 5) {
        return res.status(400).json({ message: "Invalid sort option (1-5)." });
    }

    // [2.3.1] Input validation: reject invalid or unsafe search name input.
    if (typeof searchName !== "string" || searchName.length > MAX_SEARCH_LENGTH || UNSAFE_REGEX_PATTERN.test(searchName)) {
        return res.status(400).json({ message: "Invalid name search input." });
    }

    // [2.3.1] Input validation: reject invalid or unsafe search description input.
    if (typeof searchDesc !== "string" || searchDesc.length > MAX_SEARCH_LENGTH || UNSAFE_REGEX_PATTERN.test(searchDesc)) {
        return res.status(400).json({ message: "Invalid description search input." });
    }

    // [2.3.1] Input validation: reject unknown amenity filter values.
    if (!selectedAmenities.every((amenity) => typeof amenity === "string" && ALLOWED_AMENITIES.includes(amenity))) {
        return res.status(400).json({ message: "Invalid amenities filter value." });
    }

    // [2.3.1] Input validation: reject unknown location filter values.
    if (!selectedLocations.every((location) => typeof location === "string" && ALLOWED_LOCATIONS.includes(location))) {
        return res.status(400).json({ message: "Invalid locations filter value." });
    }

    // [2.3.1] Input validation: reject invalid rating filter values.
    if (!selectedRatings.every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
        return res.status(400).json({ message: "Invalid ratings filter value." });
    }

    // [2.3.3] Data length validation: reject oversized search filter arrays.
    if (selectedAmenities.length > MAX_FILTER_ARRAY_SIZE || selectedLocations.length > MAX_FILTER_ARRAY_SIZE || selectedRatings.length > MAX_FILTER_ARRAY_SIZE) {
        return res.status(400).json({ message: "Filter selections exceed maximum allowed size." });
    }

    try {
        const searchFilter = {
            // Used ...(condition && filter) so that filter that
            ...(searchName != '' && { name : { $regex : searchName, $options : 'i' } }), // case insensitive substrings
            ...(searchDesc != '' && { shortDescription : { $regex : searchDesc, $options : 'i' } }), // case insensitive substrings
            ...(selectedAmenities.length > 0 && { amenities: { $all: selectedAmenities } }), // Use $all for AND instead of OR
            ...(selectedLocations.length > 0 && { location: { $in: selectedLocations } }),
            ...(selectedRatings.length > 0 && { $expr: { $in: [{ $floor: ["$rating"] }, selectedRatings]} }) // Floor the rating first to nearest integer then check if its in the ratings array
        };

        const establishments = await Establishment.find(searchFilter).lean();

        for(const establishment of establishments) {
            try {
              const reviews = await Review.find({ establishmentId: establishment._id }).lean();
              establishment.reviewsCount = reviews.length;
            } catch (error) {
              console.error('Something went wrong when trying to fetch number of reviews:', error);
            }
        }

        establishments.sort((A, B) => {
            switch(sortBy) {
                case 1 : return A.name.localeCompare(B.name); // alphabetically by name
                case 2 : return B.rating - A.rating; // highest to lowest rating
                case 3 : return A.rating - B.rating; // lowest to highest rating
                case 4 : return B.reviewsCount - A.reviewsCount; // most to least reviewed
                case 5 : return A.reviewsCount - B.reviewsCount; // least to most reviewed
                default : throw new Error("Achievement Unlocked : How did we get here?!");
            }
        });

        res.render("home", { establishments, user: req.session.user || null, searchName, searchDesc, amenities : selectedAmenities, locations : selectedLocations, ratings : selectedRatings });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
