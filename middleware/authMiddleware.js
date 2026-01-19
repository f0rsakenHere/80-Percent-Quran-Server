const admin = require('firebase-admin');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Verifies Firebase ID token and attaches user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided',
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token format',
      });
    }

    // Verify the Firebase ID token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error('❌ Token verification error:', error.message);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please login again.',
        });
      }
      
      if (error.code === 'auth/id-token-revoked') {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked. Please login again.',
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Find or create user in database
    const userData = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
    };

    const user = await User.findOrCreate(userData);

    // Attach user to request object
    req.user = user;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Optional authentication middleware
 * Similar to authMiddleware but doesn't fail if no token is provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      return next();
    }

    const idToken = authHeader.split('Bearer ')[1];

    if (!idToken) {
      return next();
    }

    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Find or create user
    const userData = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
    };

    const user = await User.findOrCreate(userData);

    req.user = user;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    // If token verification fails, continue without user
    console.warn('⚠️  Optional auth failed:', error.message);
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };
