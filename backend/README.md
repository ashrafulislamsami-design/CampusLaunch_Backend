# CampusLaunch - Backend API Engine

This repository hosts the backend engine of **CampusLaunch**, the developer-centric command center for university startup founders. The server is built on **Node.js**, **Express**, and **Mongoose**, with integrated security modules, real-time collaboration sockets, and automated scheduling systems.

---

## 🚀 Key Features

### 🛡️ Security & Integrity (Untouched & Active)
* **IP Rate Limiting**: Powered by `express-rate-limit` with a `redis` backup store. Automatically falls back to local memory if Redis is unavailable.
  * **General APIs**: Strictly capped at 100 requests per 15 minutes.
  * **Auth Routes**: Strictly capped at 5 attempts per 15 minutes per IP to prevent brute-force attacks.
* **Input Sanitization**: Embedded SQL/NoSQL injection, XSS, and SSTI sanitization middleware protecting all entry routes.
* **Payload Caps**: Strict JSON parsing limits (`50kb` max payload) to block Denial of Service (DoS) attempts.
* **Role-Based Access Control (RBAC)**: Secure middlewares enforcing constraints for `Student`, `Mentor`, `Organizer`, and `Admin` users.

### 🔑 Authentication Architecture
* **Dual-Verification Middleware**: Dynamically handles both **Firebase ID Tokens** (live clients) and local **Custom JWTs** (seeding and local development database overrides).
* **Automatic Firebase Account Linking**: Matches client-side Firebase sessions with local Mongo profiles and backfills the `firebaseUid` automatically.

### 📊 Real-Time Engines & Sockets
* **Socket.io Collaboration**: Enables real-time team canvas building, sticky note additions, card color updates, section focuses, and cursor indicators.
* **Mongoose Schema & Models**: Fully defined schemas for Users, Teams, Bookings, Mentors, Canvas Boards, Pitch Events, Funding watchlists, and Email logs.

### 📅 Scheduler Jobs
* Scheduled hourly, daily, and weekly tasks running on `node-cron` to automatically trigger:
  * Mentor session reminders (24h and 1h alerts).
  * Watchlisted funding deadline notifications.
  * Pitch registration and results digests.
  * Weekly digests on Monday 9AM.

---

## 🛠️ Tech Stack
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB (via Mongoose)
* **Real-time**: Socket.io
* **Rate-limiting**: Redis + memory fallback
* **Emails**: Resend API

---

## ⚙️ Environment Configuration

Create a `.env` file in the root of the `backend` directory using the parameters below:

```ini
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_signature_secret
ADMIN_SECRET=your_admin_secret_key

# Groq / Gemini AI Keys
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# Email Configuration (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=CampusLaunch

# Firebase Service Account Credentials (For Admin SDK Verification)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="your_private_key"

# Dev Bypasses
BYPASS_FIREBASE_AUTH=false
```

---

## 📦 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Seeding Scripts** (Optional, to populate database):
   ```bash
   node scripts/seedFounders.js
   node scripts/seedResources.js
   ```

3. **Start in Development Mode**:
   ```bash
   npm start
   ```

4. **Verify Health**:
   Send a GET request to `http://localhost:5000/api/health` to confirm the server and MongoDB connections are healthy.
