const admin = require("firebase-admin");

// To use this, you need to set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
// in your backend/.env file (get these from your Firebase Console Service Accounts).

let db = null;

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

  if (!admin.apps.length && privateKey && process.env.FIREBASE_CLIENT_EMAIL && !process.env.FIREBASE_CLIENT_EMAIL.includes('your-service-account')) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "mockinterview-27142",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    db = admin.firestore();
    console.log("Firebase Admin SDK Initialized Successfully");
  } else {
    console.warn("Firebase Admin SDK Not Initialized: Missing or invalid FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL in backend/.env. Interview records will not be saved to Firestore.");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error.message);
  console.warn("Continuing without Firebase Admin SDK...");
}

module.exports = { admin, db };
