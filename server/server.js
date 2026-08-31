import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import { connectDB } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Middleware to ensure DB connection before handling API routes
app.use(async (req, res, next) => {
  await connectDB();

  if (req.path === '/api/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database is not connected. Please verify your MONGODB_URI in .env file.'
    });
  }

  next();
});

// API Routes
app.use('/api/auth', authRoutes);

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date()
  });
});

// Connect to MongoDB & Start Local Express Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Express Backend Server running on http://localhost:${PORT}`);
  });
};

startServer();
