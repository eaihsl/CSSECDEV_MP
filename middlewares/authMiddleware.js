// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized. Please log in." });
  }
};

// Middleware to check if the logged-in user is an admin
const isAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: "Forbidden. Admins only." });
  }
};

module.exports = { isAuthenticated, isAdmin };