# 🖼️ Image Search & Gallery Web Application

A full-stack image search web application featuring user authentication, real-time image searching (via Unsplash API with local dataset fallback), interactive grid and single-detail views, favorites & likes persistence, and seamless dark/light theme switching.

## 🛠️ Tech Stack

### Frontend
- **Framework/Bundler**: [Vite](https://vitejs.dev/)
- **Core**: Vanilla JavaScript (ES6+ Modules), HTML5
- **Styling**: Modern Custom CSS (Flexbox, Grid, CSS Variables, Responsive Design)

### Backend
- **Server**: Node.js & Express.js
- **Database**: MongoDB & Mongoose ORM
- **Security**: JWT Authentication & bcryptjs Password Hashing
- **Environment**: Dotenv

---

## 🚀 Getting Started

Follow these steps to set up and run the application locally on your machine.

### Prerequisites

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) (running locally on port `27017` or a MongoDB Atlas Cloud URI)

---

## 📥 Installation

1. **Clone or Open Project Directory**:
   ```bash
   cd imagesWebsite
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables (`.env`)**:
   Create or update the `.env` file in the root directory with the following configuration:

   ```env
   # Server Port
   PORT=5000

   # MongoDB Connection URI (Local MongoDB)
   MONGODB_URI=mongodb://127.0.0.1:27017/image_app

   # JWT Token Secret Key
   JWT_SECRET=super_secret_image_app_key_2026

   # Optional Unsplash API Access Key
   UNSPLASH_API_KEY=your_unsplash_access_key
   ```

---

## 🏃 Running the Application

To run the application, you need to start both the **Backend Express Server** and the **Vite Frontend Development Server**.

### Option 1: Running in Two Terminals (Recommended)

1. **Terminal 1 - Start Express Backend Server**:
   ```bash
   npm run server
   ```
   *The server will start at `http://localhost:5000` and connect to MongoDB.*

2. **Terminal 2 - Start Vite Frontend Server**:
   ```bash
   npm run dev
   ```
   *The frontend will start at `http://localhost:5173`.*

---

### Option 2: Production Build & Preview

To test the production bundle:

```bash
# Build production assets
npm run build

# Preview production build
npm run preview
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Check API & MongoDB connection status | ❌ No |
| `POST` | `/api/auth/register` | Register a new user | ❌ No |
| `POST` | `/api/auth/login` | Log in existing user & return JWT token | ❌ No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | ✅ Yes (Bearer Token) |
| `POST` | `/api/auth/sync` | Sync user likes & favorites to MongoDB | ✅ Yes (Bearer Token) |

---

## 📁 Project Structure

```
imagesWebsite/
├── .env                  # Environment configuration
├── index.html            # Main HTML entry point
├── package.json          # Node dependencies and scripts
├── vite.config.js        # Vite dev server & proxy settings
├── server/               # Express Backend Server
│   ├── server.js         # Entry point for Express & MongoDB
│   ├── middleware/       # JWT Authentication middleware
│   ├── models/           # Mongoose schemas (User)
│   └── routes/           # Auth API endpoints (/api/auth)
└── src/                  # Frontend Source Code
    ├── app.js            # Main frontend application logic
    ├── style.css         # Custom application styling
    └── images-data.js    # Curated fallback dataset
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
