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
const { isAdmin } = require('../middlewares/authMiddleware');
const { logSecurityEvent } = require("../utils/securityLogger");
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

router.get("/profile", async (req, res, next) => {
  if (!req.session.user) {
      return res.redirect("/users/login");
  }

  try {
      const user = await User.findById(req.session.user._id).lean();
        if (!user) {
          const error = new Error("Resource not found");
          error.status = 404;
          return next(error);
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
      next(err);
  }
});

router.get("/:userId/profile", async (req, res, next) => {
  const userId = req.params.userId;

  try {
      const user = await User.findById(userId).lean();
        if (!user) {
          const error = new Error("Resource not found");
          error.status = 404;
          return next(error);
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
      next(err);
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
    const { username, email, password, shortDescription = "", role, tempFilename, securityQuestion, securityAnswer } = req.body;

    if (!["people", "business"].includes(role)) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because role is invalid.",
        req,
        metadata: { username, email, role }
      });
      return res.status(400).json({ message: "Invalid role selected." });
    }

    // Password complexity validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected due to weak password policy.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, and one number." });
    }

    // 2.1.9 - Security question validation
    // Reject questions with very common/predictable answers
    const rejectedQuestions = [
      "what is your favorite color",
      "what is your pet's name",
      "what is your mother's maiden name",
      "what is your birthday",
      "what is your favorite food"
    ];
    if (!securityQuestion || !securityAnswer) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because security question/answer is missing.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "A security question and answer are required." });
    }
    if (rejectedQuestions.includes(securityQuestion.trim().toLowerCase())) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because security question is too common.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "That security question is too common. Please choose a more specific question." });
    }
    if (securityAnswer.trim().length < 3) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because security answer is too short.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "Security answer must be at least 3 characters long." });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because username is unavailable.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "Username unavailable" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      logSecurityEvent({
        eventType: "AUTH_REGISTER",
        outcome: "FAILURE",
        message: "Registration rejected because email is already registered.",
        req,
        metadata: { username, email }
      });
      return res.status(400).json({ message: "E-mail already registered" });
    }

    const profilePictureFilename = tempFilename || "default_avatar.jpg"; 

    // console.log("Password received on registration:", password);
    // const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    // console.log("Hashed password being saved:", hashedPassword);

    // 2.1.9 - Hash the security answer before storing (treat it like a password)
    const hashedAnswer = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 12);

    // Create the user AFTER assigning the correct profile picture filename
    const newUser = new User({
      username,
      email,
      password,
      role,
      shortDescription,
      profilePicture: profilePictureFilename, // Assign the correct profile picture
      securityQuestion: securityQuestion.trim(),
      securityAnswer: hashedAnswer
    });

    await newUser.save();

    // 2.1.10 - Seed passwordHistory with the registration hash so it is
    // checked against on the very first password change attempt.
    // newUser.password is only the final bcrypt hash after the pre-save hook runs,
    // so we read it back here and save it as the starting history entry.
    await User.findByIdAndUpdate(newUser._id, {
      passwordHistory: [newUser.password]
    });

    req.session.user = {
      _id: newUser._id.toString(),
      username: newUser.username,
      role: newUser.role,
      profilePicture: newUser.profilePicture
    };

    logSecurityEvent({
      eventType: "AUTH_REGISTER",
      outcome: "SUCCESS",
      message: "User registration succeeded.",
      req,
      metadata: { userId: newUser._id.toString(), username: newUser.username, role: newUser.role }
    });

    res.status(201).json({ message: "Registration successful!", user: req.session.user });

  } catch (err) {
    console.error("Registration Error:", err);
    logSecurityEvent({
      eventType: "AUTH_REGISTER",
      outcome: "FAILURE",
      message: "User registration failed due to server error.",
      req,
      metadata: { reason: err.message }
    });
    res.status(500).json({ message: "Server error" });
  }
});

// 2.1.9 - Get security question for a given username (used on the reset page before answer is submitted)
router.get("/resetPassword/question", async (req, res) => {
  try {
    const { username } = req.query;

    let user = await User.findOne({ username });
    if (!user) { user = await User.findOne({ email: username }); }

    // Return the same response whether the user exists or not to avoid user enumeration
    if (!user || !user.securityQuestion) {
      return res.status(200).json({ question: null, message: "No security question found for that account." });
    }

    res.json({ question: user.securityQuestion });
  } catch (err) {
    console.error("Reset question fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 2.1.9 - Verify security answer and reset password
router.post("/resetPassword", async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;

    let user = await User.findOne({ username });
    if (!user) { user = await User.findOne({ email: username }); }

    // Generic message to avoid user enumeration
    // logging the failure with details for internal monitoring, but not revealing them to the client
    if (!user || !user.securityAnswer) { 
      logSecurityEvent({
        eventType: "AUTH_PASSWORD_RESET",
        outcome: "FAILURE",
        message: "Password reset rejected: unknown account or missing security answer.",
        req,
        metadata: { username }
      });
      return res.status(401).json({ message: "Incorrect username or security answer." });
    }

    const answerMatch = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.securityAnswer);
    if (!answerMatch) {
      logSecurityEvent({
        eventType: "AUTH_PASSWORD_RESET",
        outcome: "FAILURE",
        message: "Password reset rejected: security answer mismatch.",
        req,
        metadata: { username }
      });
      return res.status(401).json({ message: "Incorrect username or security answer." });
    }

    // Enforce same password rules as registration
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      logSecurityEvent({
        eventType: "AUTH_PASSWORD_RESET",
        outcome: "FAILURE",
        message: "Password reset rejected due to weak password policy.",
        req,
        metadata: { username }
      });
      return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, and one number." });
    }

    // Hash and save via the model's pre-save hook (12 rounds, consistent with registration)
    user.password = newPassword;
    await user.save();

    logSecurityEvent({
      eventType: "AUTH_PASSWORD_RESET",
      outcome: "SUCCESS",
      message: "Password reset succeeded.",
      req,
      metadata: { userId: user._id.toString(), username: user.username }
    });

    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("Password reset error:", err);
    logSecurityEvent({
      eventType: "AUTH_PASSWORD_RESET",
      outcome: "FAILURE",
      message: "Password reset failed due to server error.",
      req,
      metadata: { reason: err.message }
    });
    res.status(500).json({ message: "Server error" });
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
      logSecurityEvent({
        eventType: "AUTH_LOGIN",
        outcome: "FAILURE",
        message: "Login failed: account not found.",
        req,
        metadata: { username }
      });
      return res.status(401).json({ message: "Incorrect username or password." });
    }

    // 2.1.8 - Check if account is currently locked
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      logSecurityEvent({
        eventType: "AUTH_LOGIN",
        outcome: "FAILURE",
        message: "Login blocked: account is temporarily locked.",
        req,
        metadata: { username: user.username, userId: user._id.toString(), minutesLeft }
      });
      return res.status(403).json({ message: `Account is temporarily locked. Please try again in ${minutesLeft} minute(s).` });
    }

    const isMatch = await bcrypt.compare(password, user.password); // Compare hashed password
    if (!isMatch) {
      // 2.1.8 - Increment failed attempts and lock if threshold reached
      const newAttempts = (user.loginAttempts || 0) + 1;
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        await User.findByIdAndUpdate(user._id, {
          loginAttempts: newAttempts,
          lockUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
          lastLoginAttemptAt: new Date(),  // 2.1.12
          lastLoginSuccess: false          // 2.1.12
        });
        logSecurityEvent({
          eventType: "AUTH_LOGIN",
          outcome: "FAILURE",
          message: "Login failed: account locked after too many attempts.",
          req,
          metadata: { username: user.username, userId: user._id.toString(), attempts: newAttempts }
        });
        return res.status(403).json({ message: "Too many failed login attempts. Account locked for 15 minutes." });
      }
      await User.findByIdAndUpdate(user._id, {
        loginAttempts: newAttempts,
        lastLoginAttemptAt: new Date(),  // 2.1.12
        lastLoginSuccess: false          // 2.1.12
      });
      logSecurityEvent({
        eventType: "AUTH_LOGIN",
        outcome: "FAILURE",
        message: "Login failed: invalid credentials.",
        req,
        metadata: { username: user.username, userId: user._id.toString(), attempts: newAttempts }
      });
      return res.status(401).json({ message: "Incorrect username or password." });
    }

    // 2.1.8 - Reset lockout fields on successful login
    // 2.1.12 - Capture last login info BEFORE overwriting it, then update
    const lastLoginAt = user.lastLoginAt || null;
    const lastLoginAttemptAt = user.lastLoginAttemptAt || null;
    const lastLoginSuccess = user.lastLoginSuccess;

    await User.findByIdAndUpdate(user._id, {
      loginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
      lastLoginAttemptAt: new Date(),
      lastLoginSuccess: true
    });

    req.session.user = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    logSecurityEvent({
      eventType: "AUTH_LOGIN",
      outcome: "SUCCESS",
      message: "Login succeeded.",
      req,
      metadata: { userId: user._id.toString(), username: user.username, role: user.role }
    });

    // 2.1.12 - Include previous login info in the response so the frontend can display it
    res.json({
      message: "Login successful!",
      user: req.session.user,
      lastLogin: {
        lastLoginAt,
        lastLoginAttemptAt,
        lastLoginSuccess
      }
    });

  } catch (err) {
    logSecurityEvent({
      eventType: "AUTH_LOGIN",
      outcome: "FAILURE",
      message: "Login failed due to server error.",
      req,
      metadata: { reason: err.message }
    });
    res.status(500).json({ message: "Server error" });
  }
});

// Logout a user
router.get("/logout", (req, res) => {
  if (!req.session.user) {
    logSecurityEvent({
      eventType: "AUTH_LOGOUT",
      outcome: "FAILURE",
      message: "Logout attempted without an active session.",
      req
    });
    return res.redirect("/");
  }

  req.session.destroy((err) => {
    if (err) {
      logSecurityEvent({
        eventType: "AUTH_LOGOUT",
        outcome: "FAILURE",
        message: "Logout failed during session destruction.",
        req,
        metadata: { reason: err.message }
      });
      return res.status(500).json({ message: "Logout failed" });
    }
    logSecurityEvent({
      eventType: "AUTH_LOGOUT",
      outcome: "SUCCESS",
      message: "Logout succeeded.",
      req
    });
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
    const { shortDescription, password, currentPassword, resetProfilePicture } = req.body;

    if (shortDescription) updates.shortDescription = shortDescription;

    if (password) {
      // 2.1.13 - Re-authenticate: require current password before allowing a change
      if (!currentPassword) {
        return res.status(400).json({ message: "Your current password is required to set a new password." });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Current password is incorrect." });
      }

      // 2.1.5 / 2.1.6 - Enforce same complexity and length requirements as registration
      const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Password must be at least 8 characters long, contain at least one uppercase letter, and one number." });
      }

      // 2.1.11 - Prevent changing password if it was changed less than 1 day ago
      if (user.passwordChangedAt) {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const msSinceChange = Date.now() - new Date(user.passwordChangedAt).getTime();
        if (msSinceChange < ONE_DAY_MS) {
          const hoursLeft = Math.ceil((ONE_DAY_MS - msSinceChange) / (60 * 60 * 1000));
          return res.status(400).json({ message: `Password was changed recently. Please wait ${hoursLeft} more hour(s) before changing it again.` });
        }
      }

      // 2.1.10 - Prevent re-use of the last 5 passwords
      const history = user.passwordHistory || [];
      for (const oldHash of history) {
        const isReused = await bcrypt.compare(password, oldHash);
        if (isReused) {
          return res.status(400).json({ message: "You cannot reuse a recent password. Please choose a different password." });
        }
      }

      const newHash = await bcrypt.hash(password, 12);

      // 2.1.10 - Add current password to history before replacing it, keep last 5 only
      const updatedHistory = [user.password, ...history].slice(0, 5);
      updates.passwordHistory = updatedHistory;

      // 2.1.11 - Record the time of this password change
      updates.passwordChangedAt = new Date();

      updates.password = newHash;
    }

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
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
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
//     res.status(500).json({ message: "Server error" });
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
//     res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
  }
});


// ── ADMIN: view all users ────────────────────────────────────────────────────
router.get('/admin/dashboard', isAdmin, async (req, res, next) => {
  try {
    const users = await User.find({}, 'username email role profilePicture createdAt').lean();
    res.render('admin', { users });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    next(err);
  }
});

// ── ADMIN: delete any user by ID ─────────────────────────────────────────────
router.delete('/admin/deleteUser/:userId', isAdmin, async (req, res) => {
  const { userId } = req.params;

  // Prevent admin from deleting themselves
  if (req.session.user._id === userId) {
    return res.status(400).json({ message: 'You cannot delete your own account here.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Delete profile picture if not default
    if (user.profilePicture && user.profilePicture !== 'default_avatar.jpg') {
      const filePath = path.join(__dirname, '../public/profile_pictures', user.profilePicture);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete profile picture:', err);
      });
    }

    // Delete their reviews and associated comments/images
    const userReviews = await Review.find({ userId });
    for (const review of userReviews) {
      review.images.forEach((img) => {
        const filePath = path.join('public/review_pictures', img);
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete review image:', err);
        });
      });
      await Comment.deleteMany({ _id: { $in: review.comments } });
    }
    await Review.deleteMany({ userId });
    await Comment.deleteMany({ userId });
    await Review.updateMany({}, { $pull: { likes: userId, dislikes: userId } });

    // Delete their gyms and gym reviews
    const userGyms = await Establishment.find({ owner: userId });
    for (const gym of userGyms) {
      const gymReviews = await Review.find({ establishmentId: gym._id });
      for (const review of gymReviews) {
        review.images.forEach((img) => {
          const filePath = path.join('public/review_pictures', img);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete review image:', err);
          });
        });
        await Comment.deleteMany({ _id: { $in: review.comments } });
      }
      await Review.deleteMany({ establishmentId: gym._id });
      if (gym.image && gym.image !== 'default_establishment.jpg') {
        const gymImagePath = path.join(__dirname, '../public/establishment_pictures', gym.image);
        fs.unlink(gymImagePath, (err) => {
          if (err) console.error('Failed to delete gym image:', err);
        });
      }
    }
    await Establishment.deleteMany({ owner: userId });

    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;