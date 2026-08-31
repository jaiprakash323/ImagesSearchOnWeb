import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from '../server/routes/authRoutes.js';
import { connectDB } from '../server/db.js';

const app = express();

app.use(cors());
app.use(express.json());

// Ensure MongoDB database connection per serverless execution
app.use(async (req, res, next) => {
  await connectDB();

  // Allow health endpoint to respond even if DB is disconnected
  if (req.path === '/api/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    const hasUri = !!process.env.MONGODB_URI;
    return res.status(503).json({
      error: hasUri
        ? 'MongoDB Atlas connection failed or timed out. Ensure 0.0.0.0/0 (Allow access from anywhere) is enabled in MongoDB Atlas Network Access.'
        : 'MONGODB_URI environment variable is missing. Please add MONGODB_URI in your Vercel Project Settings.'
    });
  }

  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

// Default catch-all for /api
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

export default app;
