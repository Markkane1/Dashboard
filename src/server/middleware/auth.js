const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const API_TOKEN_ISSUER = 'next-auth';
const API_TOKEN_AUDIENCE = 'express-api';
const API_TOKEN_USE = 'api';

/**
 * Express Authentication Middleware.
 * Decodes the JWT from the Authorization Header (Bearer token), and sets req.user.
 */
module.exports = function (req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_SECRET, {
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE
    });

    if (decoded.tokenUse !== API_TOKEN_USE) {
      return res.status(401).json({ error: 'Authentication failed. Token is not an API access token.' });
    }
    
    req.user = {
      ...decoded,
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'student'
    };
    
    next();
  } catch (err) {
    console.error("JWT authentication verification failed:", err.message);
    res.status(401).json({ error: 'Authentication failed. Token is invalid or expired.' });
  }
};
