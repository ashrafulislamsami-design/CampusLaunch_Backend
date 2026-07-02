// backend/config/firebase.js
const admin = require('firebase-admin');

let serviceAccountConfig;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccountConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  };
} else {
  try {
    serviceAccountConfig = require('./firebase-service-account.json');
  } catch (err) {
    console.error('Firebase Service Account configuration missing.');
  }
}

if (serviceAccountConfig) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountConfig)
  });
}

module.exports = admin;