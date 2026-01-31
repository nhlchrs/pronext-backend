import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

/**
 * Main Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    console.log(`[AUTH DEBUG] Route: ${req.method} ${req.path}`);
    console.log(`[AUTH DEBUG] Token present: ${!!token}`);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "JWT token missing"
      });
    }

    // Remove 'Bearer ' prefix if present
    const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;

    const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);
    console.log(`[AUTH DEBUG] Decoded user role: ${decoded.role}`);
    req.user = decoded;
    next();
  } catch (err) {
    console.log(`[AUTH DEBUG] Auth error: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: "Unauthorized Access. Invalid or expired token."
    });
  }
};

/**
 * Alias for authMiddleware for backward compatibility
 */
export const requireSignin = authMiddleware;

/**
 * Validate User Input
 */
export const validateUser = (req, res, next) => {
  const { fname, lname, email, password } = req.body;

  if (!fname || !lname || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  next();
};

/**
 * Hash Password
 */
export const hashPassword = async (password) => {
  try {
    const saltRound = 10;
    const hashedPassword = await bcrypt.hash(password, saltRound);
    return hashedPassword;
  } catch (err) {
    console.error('Error hashing password:', err);
    throw err;
  }
};

/**
 * Compare Passwords
 */
export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (err) {
    console.error('Error comparing passwords:', err);
    throw err;
  }
};

/**
 * Check if user is Admin
 */
export const isAdmin = (req, res, next) => {
  try {
    console.log(`[ADMIN CHECK] Route: ${req.method} ${req.path}`);
    console.log(`[ADMIN CHECK] User exists: ${!!req.user}`);
    console.log(`[ADMIN CHECK] User role: ${req.user?.role}`);
    
    if (!req.user || req.user.role !== "Admin") {
      console.log(`[ADMIN CHECK] Access denied - Admin role required`);
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }
    console.log(`[ADMIN CHECK] Access granted`);
    next();
  } catch (error) {
    console.log(`[ADMIN CHECK] Error: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
};

/**
 * Check if user is Support
 */
export const isSupport = (req, res, next) => {
  try {
    console.log(`[SUPPORT CHECK] Route: ${req.method} ${req.path}`);
    console.log(`[SUPPORT CHECK] User role: ${req.user?.role}`);
    
    if (!req.user || req.user.role !== "Support") {
      console.log(`[SUPPORT CHECK] Access denied - Support role required`);
      return res.status(403).json({
        success: false,
        message: "Support access required"
      });
    }
    console.log(`[SUPPORT CHECK] Access granted`);
    next();
  } catch (error) {
    console.log(`[SUPPORT CHECK] Error: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
};

/**
 * Check if user is Admin or Support (Staff)
 */
export const isStaff = (req, res, next) => {
  try {
    console.log(`[STAFF CHECK] Route: ${req.method} ${req.path}`);
    console.log(`[STAFF CHECK] User role: ${req.user?.role}`);
    
    if (!req.user || (req.user.role !== "Admin" && req.user.role !== "Support")) {
      console.log(`[STAFF CHECK] Access denied - Admin or Support role required`);
      return res.status(403).json({
        success: false,
        message: "Staff access required"
      });
    }
    console.log(`[STAFF CHECK] Access granted`);
    next();
  } catch (error) {
    console.log(`[STAFF CHECK] Error: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }
};


/**
 * Check if user is verified (KYC verified)
 */
export const isVerified = (req, res, next) => {
  try {
    if (!req.user || req.user.kycStatus !== "verified") {
      return res.status(403).json({
        success: false,
        message: "User must be KYC verified"
      });
    }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Verification check failed"
    });
  }
};

/**
 * Check if user account is active
 */
export const isActive = (req, res, next) => {
  try {
    if (!req.user || req.user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive or suspended"
      });
    }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Status check failed"
    });
  }
};

/**
 * Check if user has required subscription tier
 */
export const hasSubscription = (requiredTiers = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated"
        });
      }

      if (requiredTiers.length > 0 && !requiredTiers.includes(req.user.subscriptionTier)) {
        return res.status(403).json({
          success: false,
          message: `Required subscription tier: ${requiredTiers.join(', ')}`
        });
      }

      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        message: "Subscription check failed"
      });
    }
  };
};

/**
 * Check if user has active subscription (not expired)
 * Checks subscriptionStatus and subscriptionExpiryDate
 */
export const hasActiveSubscription = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    // Check if subscription status is active
    if (!req.user.subscriptionStatus) {
      return res.status(403).json({
        success: false,
        message: "Active subscription is required to access this resource",
        code: "NO_SUBSCRIPTION"
      });
    }

    // Check if subscription has expired
    if (req.user.subscriptionExpiryDate) {
      const expiryDate = new Date(req.user.subscriptionExpiryDate);
      const currentDate = new Date();
      
      if (currentDate > expiryDate) {
        return res.status(403).json({
          success: false,
          message: "Your subscription has expired. Please renew to continue.",
          code: "SUBSCRIPTION_EXPIRED",
          expiryDate: expiryDate
        });
      }
    }

    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Subscription verification failed"
    });
  }
};

/**
 * Optional Authentication - continues if valid, but doesn't require auth
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (token) {
      const tokenWithoutBearer = token.startsWith('Bearer ') ? token.slice(7) : token;
      try {
        const decoded = jwt.verify(tokenWithoutBearer, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (err) {
        // Token is invalid, but we continue anyway (optional)
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Default export for backward compatibility
export default authMiddleware;