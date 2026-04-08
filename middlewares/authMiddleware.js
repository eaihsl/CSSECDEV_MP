// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
      next(); // User is logged in, continue
    } else {
      res.status(401).json({ message: "Unauthorized. Please log in." });
    }
  };
  
  module.exports = { isAuthenticated };
  