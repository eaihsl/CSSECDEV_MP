// Middleware to make session data available to Handlebars views
module.exports = (req, res, next) => {
  res.locals.isAuthenticated = !!req.session.user; // Converts to true/false
  res.locals.user = req.session.user || null;
  next();
};
