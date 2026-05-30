const jwt = require('jsonwebtoken');

/**
 * Express Authentication Middleware.
 * Decodes the JWT from the Authorization Header (Bearer token) or req.query.token, and sets req.user.
 */
module.exports = function (req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  try {
    // Decodes the token using the system NEXTAUTH_SECRET (or default fallback for development)
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'jwtSecret');
    
    // Decoded object should contain user identity: { id, email, name, etc. }
    req.user = decoded;
    
    next();
  } catch (err) {
    console.error("JWT authentication verification failed:", err.message);
    res.status(401).json({ error: 'Authentication failed. Token is invalid or expired.' });
  }
};
