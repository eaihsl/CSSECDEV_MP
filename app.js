/*
  Import necessary packages:
  1. express.js
  2. mongoose
  3. dotenv (loads environment variables)
  4. express-session (manages user sessions)
*/
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const session = require("express-session");
const path = require("path");
const { engine } = require("express-handlebars");
const sessionMiddleware = require("./middlewares/sessionMiddleware");

/*
  Import routes:
  1. User routes (login, registration, etc.)
  2. Establishment routes
  3. Review routes
*/
const userRoutes = require("./routes/userRoutes");
const establishmentRoutes = require("./routes/establishmentRoutes");
const homeRoutes = require("./routes/homeRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const commentRoutes = require('./routes/commentRoutes');

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();

// Set Handlebars as the view engine
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
      //Denzel's equality temp solution
      helpers: {
          equal: function(a, b) {
              return a === b;
          },
          includes: function(a, b){
              return Array.isArray(a) && a.includes(b)
          }
      }
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));

// Parse incoming JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false, // Do not save session if it hasn't changed
    saveUninitialized: true, // Save new sessions
      cookie: {
          maxAge: 30 * 24 * 60 * 60 * 1000
      }
  })
);

app.use(sessionMiddleware); // Makes session data available to Handlebars

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// routes
app.use("/", homeRoutes);

// Define API routes
app.use("/users", userRoutes); // User related routes
app.use("/establishments", establishmentRoutes); // Establishment routes
app.use("/reviews", reviewRoutes);
app.use('/comments', commentRoutes.router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://127.0.0.1:${PORT}`));
