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
