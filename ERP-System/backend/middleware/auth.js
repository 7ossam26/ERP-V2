const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || "fallback_secret_key_change_me",
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid or expired token." });
      }
      req.user = user;
      next();
    }
  );
};

const isSuperadmin = (req, res, next) => {
  if (!req.user || req.user.role !== "Superadmin") {
    return res
      .status(403)
      .json({ error: "Access denied. Superadmin privileges required." });
  }
  next();
};

module.exports = {
  authenticateToken,
  isSuperadmin,
};
