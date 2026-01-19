const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Initialize Firebase Admin SDK
 * @returns {admin.app.App|null} Firebase Admin app instance or null if not configured
 */
const initializeFirebase = () => {
  try {
    // Check if Firebase service account path is configured
    let serviceAccount;

    // Option 1: Env Var with raw JSON string (Best for Vercel)
    if (process.env.FIREBASE_CONFIG_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
    } 
    // Option 2: File path (Best for Local Dev)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = require(serviceAccountPath);
      } else {
        console.warn('⚠️  Firebase service account file not found:', serviceAccountPath);
      }
    }

    if (!serviceAccount) {
       console.warn('⚠️  Firebase credentials missing. Auth disabled.');
       return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin SDK initialized');
    return admin;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    console.warn('⚠️  Server will start but authentication will be disabled');
    return null;
  }
};

module.exports = initializeFirebase;
