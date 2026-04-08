const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Establishment = require("../models/Establishment");
const Review = require("../models/Review");
const Comment = require('../models/Comment');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const dotenv = require("dotenv");
dotenv.config();
const sourceEmail = process.env.SOURCE_EMAIL;
const sourceEmailPassword = process.env.SOURCE_PASSWORD;

// Multer storage for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/profile_pictures/"); // Store images in this folder
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename); // Assign unique filename
  }
});

// Multer middleware
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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Multer storage for gym image uploads
const gymStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/establishment_pictures/");
  },
  filename: (req, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const gymUpload = multer({
  storage: gymStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpg/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Only .jpg files are allowed!"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const fetchUserDetails = async (user) => {
  let establishments = [];
  let userReviews = [];
  const isBusiness = user.role === "business";

  switch (isBusiness) {
    case true:
      establishments = await Establishment.find({ owner: user._id }).lean();
      break;
    case false:
      userReviews = await Review.find({ userId: user._id }).lean();
      for (let review of userReviews) {
        let currentEstablishment = await Establishment.findOne({ _id: review.establishmentId }).lean();
        if (currentEstablishment) {
          review.image = currentEstablishment.image;
          review.name = currentEstablishment.name;
        }
        review.stars = '★'.repeat(review.rating);
      }
      break;
  }

  return { establishments, userReviews, isBusiness };
};

router.get("/profile", async (req, res) => {
  if (!req.session.user) {
      return res.redirect("/users/login");
  }

  try {
      const user = await User.findById(req.session.user._id).lean();
      if (!user) {
          return res.status(404).send("User not found");
      }

      const { establishments, userReviews, isBusiness } = await fetchUserDetails(user);

      const userComments = await Comment.find({ userId: user._id })
      .populate({
        path: 'reviewId',
        model: 'Review',
        populate: { path: 'establishmentId', model: 'Establishment' }
      })
      .lean();

      if(isBusiness) {
        for(const gym of establishments) {
          gym.isUser = true;
        }
      } else {
        for(const review of userReviews) {
          review.isUser = true;
          review.images = review.images.map(image => ({
            src: image,
            reviewId: review._id
          }));
        }
        for(const comment of userComments) {
          comment.isUser = true;
        }
      }
      
      res.render("profile", { user, isBusiness, gyms: establishments, reviews: userReviews, comments: userComments, isCurrentUser : true });
      
  } catch (err) {
      console.error("Error retrieving profile:", err);
      res.status(500).send("Server error");
  }
});

router.get("/:userId/profile", async (req, res) => {
  const userId = req.params.userId;

  try {
      const user = await User.findById(userId).lean();
      if (!user) {
          return res.status(404).send("User not found");
      }

      const { establishments, userReviews, isBusiness } = await fetchUserDetails(user);

      const userComments = await Comment.find({ userId: user._id })
      .populate({
        path: 'reviewId',
        model: 'Review',
        populate: { path: 'establishmentId', model: 'Establishment' }
      })
      .lean();

      let isCurrentUser = false;
      if(!req.session.user) {
        isCurrentUser = false;
      } else {
        isCurrentUser = userId === req.session.user._id;
      }

      if(isBusiness) {
        for(const gym of establishments) {
          gym.isUser = isCurrentUser;
        }
      } else {
        for(const review of userReviews) {
          review.isUser = isCurrentUser;
          review.images = review.images.map(image => ({
            src: image,
            reviewId: review._id
          }));
        }
        for(const comment of userComments) {
          comment.isUser = isCurrentUser;
        }
      }

      res.render("profile", { user, isBusiness, gyms: establishments, reviews: userReviews, comments: userComments, isCurrentUser : isCurrentUser });

  } catch (err) {
      console.error("Error retrieving user profile:", err);
      res.status(500).send("Server error");
  }
});

router.post("/uploadTempProfilePicture", upload.single("profilePicture"), (req, res) => {
  if (!req.file) {
    console.error("No file uploaded.");
    return res.status(400).json({ message: "No file uploaded." });
  }

  console.log("Image uploaded successfully:", req.file.filename);

  res.json({ message: "Profile picture uploaded.", filename: req.file.filename });
});

// Register a new user
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, shortDescription = "", role, tempFilename } = req.body;

    if (!["people", "business"].includes(role)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "E-mail already registered" });
    }

    const profilePictureFilename = tempFilename || "default_avatar.jpg"; 

    // console.log("Password received on registration:", password);
    // const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    // console.log("Hashed password being saved:", hashedPassword);

    // Create the user AFTER assigning the correct profile picture filename
    const newUser = new User({
      username,
      email,
      password,
      role,
      shortDescription,
      profilePicture: profilePictureFilename // Assign the correct profile picture
    });

    await newUser.save();

    req.session.user = {
      _id: newUser._id.toString(),
      username: newUser.username,
      role: newUser.role,
      profilePicture: newUser.profilePicture
    };

    res.status(201).json({ message: "Registration successful!", user: req.session.user });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Login a user
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user without requiring a role
    let user = await User.findOne({ username });

// Checks the email list
    if (!user) {
      user = await User.findOne({ email: username });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password); // Compare hashed password
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    req.session.user = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role, // Now the role is retrieved from the database
    };

    res.json({ message: "Login successful!", user: req.session.user });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Logout a user
router.get("/logout", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie("connect.sid", { path: "/" });
    return res.redirect("/"); // Redirect to homepage after logout
  });
});

// GET /session - Check if a user session exists and return authentication status
router.get("/session", (req, res) => {
  if (req.session.user) {
    res.json({ isAuthenticated: true, user: req.session.user });
  } else {
    res.json({ isAuthenticated: false });
  }
});

// Update a user
router.put("/:userId", upload.single("profilePicture"), async (req, res) => {
  const userId = req.params.userId;

  if (req.session.user._id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });
    
    const updates = {};
    const { shortDescription, password, resetProfilePicture } = req.body;

    if (shortDescription) updates.shortDescription = shortDescription;
    if (password) updates.password = await bcrypt.hash(password, 10);

    if (req.file) {
      if (user.profilePicture !== 'default_avatar.jpg') {
        const oldPath = path.join(__dirname, "../public/profile_pictures", user.profilePicture);
        fs.unlink(oldPath, (err) => {
          if (err) console.error("Error deleting old profile picture:", err);
        });
      }
      updates.profilePicture = req.file.filename;
    }

    if (resetProfilePicture === 'true') {
      if (user.profilePicture && user.profilePicture !== 'default_avatar.jpg') {
        const oldPath = path.join(__dirname, "../public/profile_pictures", user.profilePicture);
        fs.unlink(oldPath, (err) => {
          if (err) console.error("Error deleting old profile picture:", err);
        });
      }
    
      updates.profilePicture = 'default_avatar.jpg';
    }

    await User.findByIdAndUpdate(userId, updates);
    res.json({ message: "User updated successfully." });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  if (req.session.user._id !== userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    if (user.profilePicture !== "default_avatar.jpg") {
        const filePath = path.join(__dirname, "../public/profile_pictures", user.profilePicture);
        fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete image:", err);
        });
    }

    const userReviews = await Review.find({ userId });
    for (const review of userReviews) {
      review.images.forEach((img) => {
        const filePath = path.join("public/review_pictures", img);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Failed to delete review image:", err);
        });
      });

      await Comment.deleteMany({ _id: { $in: review.comments } });
    }
    await Review.deleteMany({ userId });

    await Comment.deleteMany({ userId });

    await Review.updateMany({}, {
      $pull: { likes: userId, dislikes: userId }
    });

    const userGyms = await Establishment.find({ owner: userId });
    for (const gym of userGyms) {
      const gymReviews = await Review.find({ establishmentId: gym._id });
      for (const review of gymReviews) {
        review.images.forEach((img) => {
          const filePath = path.join("public/review_pictures", img);
          fs.unlink(filePath, (err) => {
            if (err) console.error("Failed to delete review image:", err);
          });
        });
        await Comment.deleteMany({ _id: { $in: review.comments } });
      }
      await Review.deleteMany({ establishmentId: gym._id });

      if (gym.image && gym.image !== "default_establishment.jpg") {
        const gymImagePath = path.join(__dirname, "../public/establishment_pictures", gym.image);
        fs.unlink(gymImagePath, (err) => {
          if (err) console.error("Failed to delete gym image:", err);
        });
      }
    }
    await Establishment.deleteMany({ owner: userId });

    await User.findByIdAndDelete(userId);

    // Destroy session after deletion
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
    });

    res.json({ message: "User deleted successfully." });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/createGym", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const { gymName, gymDesc, address, contactNumber, regions, amenities, profilePicture } = req.body;

    const existingEstablishment = await Establishment.findOne({ name: gymName, owner: req.session.user._id });
    if (existingEstablishment) {
      return res.status(400).json({ message: "You already have a gym with this name." });
    }

    const profilePictureFilename = profilePicture
        ? `profile_picture_${Date.now()}.jpg`  // Generate a unique filename for the image
        : "default_avatar.jpg";

    if (profilePicture) {
      const base64Data = profilePicture.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(path.join(__dirname, 'uploads', profilePictureFilename), buffer);
    }

    const newEstablishment = new Establishment({
      name: gymName,
      shortDescription: gymDesc,
      location: regions,
      address,
      contactNumber,
      amenities: Array.isArray(amenities) ? amenities : [amenities],
      rating: 0,
      owner: req.session.user._id,
      image: profilePictureFilename
    });

    await newEstablishment.save();
    
    res.status(201).json({ message: "Establishment created successfully!", establishment: newEstablishment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// router.put("/updateGym/:gymId", async (req, res) => {
//   try {
//     if (!req.session.user) {
//       return res.status(401).json({ message: "Unauthorized. Please log in." });
//     }

//     const { gymId } = req.params;
//     const { gymName, gymDesc, address, contactNumber, regions, amenities, profilePicture } = req.body;

//     const existingEstablishment = await Establishment.findOne({ _id: gymId, owner: req.session.user._id });
//     if (!existingEstablishment) {
//       return res.status(404).json({ message: "Gym not found or you don't have permission to edit it." });
//     }

//     if (gymName !== existingEstablishment.name) {
//       const duplicateEstablishment = await Establishment.findOne({ name: gymName, owner: req.session.user._id });
//       if (duplicateEstablishment) {
//         return res.status(400).json({ message: "You already have a gym with this name." });
//       }
//     }

//     const profilePictureFilename = profilePicture
//         ? `profile_picture_${Date.now()}.jpg` : existingEstablishment.image;

//     if (profilePicture) {
//       const base64Data = profilePicture.split(',')[1];
//       const buffer = Buffer.from(base64Data, 'base64');
//       fs.writeFileSync(path.join(__dirname, 'uploads', profilePictureFilename), buffer);
//     }

//     existingEstablishment.name = gymName;
//     existingEstablishment.shortDescription = gymDesc;
//     existingEstablishment.address = address;
//     existingEstablishment.contactNumber = contactNumber;
//     existingEstablishment.location = regions;
//     existingEstablishment.amenities = Array.isArray(amenities) ? amenities : [amenities];
//     existingEstablishment.image = profilePictureFilename;

//     await existingEstablishment.save();

//     res.status(200).json({ message: "Gym updated successfully!", establishment: existingEstablishment });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

// router.put("/updateGym/:gymId", gymUpload.single("gymImage"), async (req, res) => {
//   try {
//     if (!req.session.user) {
//       return res.status(401).json({ message: "Unauthorized. Please log in." });
//     }

//     const { gymId } = req.params;
//     const { gymName, gymDesc, address, contactNumber, regions, amenities } = req.body;

//     const existingEstablishment = await Establishment.findOne({ _id: gymId, owner: req.session.user._id });
//     if (!existingEstablishment) {
//       return res.status(404).json({ message: "Gym not found or you don't have permission to edit it." });
//     }

//     if (gymName !== existingEstablishment.name) {
//       const duplicateEstablishment = await Establishment.findOne({ name: gymName, owner: req.session.user._id });
//       if (duplicateEstablishment) {
//         return res.status(400).json({ message: "You already have a gym with this name." });
//       }
//     }

//     const uploadedImage = req.file?.filename;

//     existingEstablishment.name = gymName;
//     existingEstablishment.shortDescription = gymDesc;
//     existingEstablishment.address = address;
//     existingEstablishment.contactNumber = contactNumber;
//     existingEstablishment.location = regions;
//     existingEstablishment.amenities = Array.isArray(amenities) ? amenities : [amenities];
    
//     // if (uploadedImage) {
//     //   existingEstablishment.image = uploadedImage;
//     // }

//     if (uploadedImage) {
//       // delete previous image if it's not the default
//       if (existingEstablishment.image && existingEstablishment.image !== "default_establishment.jpg") {
//         const oldImagePath = path.join(__dirname, "../public/establishment_pictures", existingEstablishment.image);
//         fs.unlink(oldImagePath, (err) => {
//           if (err) {
//             console.error("Failed to delete old gym image:", err);
//           }
//         });
//       }
    
//       existingEstablishment.image = uploadedImage;
//     }

//     await existingEstablishment.save();

//     res.status(200).json({ message: "Gym updated successfully!", establishment: existingEstablishment });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

router.put("/updateGym/:gymId", gymUpload.single("gymImage"), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const { gymId } = req.params;
    const { gymName, gymDesc, address, contactNumber, regions, amenities, resetImage } = req.body;

    const existingEstablishment = await Establishment.findOne({ _id: gymId, owner: req.session.user._id });
    if (!existingEstablishment) {
      return res.status(404).json({ message: "Gym not found or you don't have permission to edit it." });
    }

    if (gymName !== existingEstablishment.name) {
      const duplicateEstablishment = await Establishment.findOne({ name: gymName, owner: req.session.user._id });
      if (duplicateEstablishment) {
        return res.status(400).json({ message: "You already have a gym with this name." });
      }
    }

    const uploadedImage = req.file?.filename;

    existingEstablishment.name = gymName;
    existingEstablishment.shortDescription = gymDesc;
    existingEstablishment.address = address;
    existingEstablishment.contactNumber = contactNumber;
    existingEstablishment.location = regions;
    existingEstablishment.amenities = Array.isArray(amenities) ? amenities : [amenities];

    if (resetImage === "true" && existingEstablishment.image !== "default_establishment.jpg") {
      const oldImagePath = path.join(__dirname, "../public/establishment_pictures", existingEstablishment.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
      existingEstablishment.image = "default_establishment.jpg";
    } else if (uploadedImage) {
      if (existingEstablishment.image && existingEstablishment.image !== "default_establishment.jpg") {
        const oldImagePath = path.join(__dirname, "../public/establishment_pictures", existingEstablishment.image);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.error("Failed to delete old gym image:", err);
        });
      }
      existingEstablishment.image = uploadedImage;
    }

    await existingEstablishment.save();

    res.status(200).json({ message: "Gym updated successfully!", establishment: existingEstablishment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/deleteGym/:gymId", async (req, res) => {
  const { username, password } = req.body;
  const { gymId } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const gymReviews = await Review.find({ establishmentId: gymId });
    for (const review of gymReviews) {
      review.images.forEach((img) => {
        const filePath = path.join("public/review_pictures", img);
        fs.unlink(filePath, (err) => {
          if (err) console.error("Failed to delete review image:", err);
        });
      });

      await Comment.deleteMany({ _id: { $in: review.comments } });
    }
    await Review.deleteMany({ establishmentId: gymId });

    const deletedGym = await Establishment.findByIdAndDelete(gymId);
    if (!deletedGym) {
      return res.status(404).json({ message: "Gym not found." });
    }

    if (deletedGym.image && deletedGym.image !== "default_establishment.jpg") {
      const imagePath = path.join(__dirname, "../public/establishment_pictures", deletedGym.image);
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Failed to delete gym image:", err);
        }
      });
    }

    return res.status(200).json({ message: "Gym deleted successfully!" });
  } catch (error) {
    console.error("Error deleting gym:", error);
    res.status(500).json({ message: "Server error, please try again later." });
  }
});

router.post("/createGymWithImage", gymUpload.single("gymImage"), async (req, res) => {
  console.log("Uploaded gym image file:", req.file);
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const {
      gymName,
      gymDesc,
      address,
      contactNumber,
      regions,
      amenities
    } = req.body;

    // let amenities = req.body["amenities[]"] || [];
    // if (!Array.isArray(amenities)) {
    //   amenities = [amenities];
    // }

    const existingEstablishment = await Establishment.findOne({
      name: gymName,
      owner: req.session.user._id,
    });

    if (existingEstablishment) {
      return res.status(400).json({ message: "You already have a gym with this name." });
    }

    const imageFilename = req.file?.filename || "default_establishment.jpg";

    const newEstablishment = new Establishment({
      name: gymName,
      shortDescription: gymDesc,
      location: regions,
      address,
      contactNumber,
      amenities: Array.isArray(amenities) ? amenities : [amenities],
      rating: 0,
      owner: req.session.user._id,
      image: imageFilename,
    });

    await newEstablishment.save();

    res.status(201).json({
      message: "Establishment created successfully!",
      establishment: newEstablishment,
    });
  } catch (err) {
    console.error("Create Gym Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
