const express = require("express");
const router = express.Router();
const Establishment = require("../models/Establishment");
const Review = require("../models/Review");

// Get all establishments
router.get("/", async (req, res) => {
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
        res.status(500).send("Internal Server Error");
    }
});

// Search results
router.get("/results", async (req, res) => {
    const searchName = req.query.nameSearch || '';
    const searchDesc= req.query.descSearch || '';
    // Hope you like ternary operators
    // Ensures that selectedAmenities and selectedLocations is always an array
    const selectedAmenities = Array.isArray(req.query.amenities) ? req.query.amenities : req.query.amenities ? [req.query.amenities] : [];
    const selectedLocations = Array.isArray(req.query.regions) ? req.query.regions : req.query.regions ? [req.query.regions] : [];
    const selectedRatings = Array.isArray(req.query.ratings) ? req.query.ratings.map(Number) : req.query.ratings ? [Number(req.query.ratings)] : [];
    const sortBy = Number(req.query.sortby) || 1;

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
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
