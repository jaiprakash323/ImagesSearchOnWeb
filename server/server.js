import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/image_app';

app.use(cors());
app.use(express.json());

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

// Connect to MongoDB & Start Server
const startServer = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/image_app';
  let connected = false;

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Successfully connected to MongoDB Database');
      connected = true;
    } catch (err) {
      console.warn('⚠️ Primary MongoDB connection failed:', err.message);
    }
  }

  if (!connected && primaryUri !== localUri) {
    try {
      console.log('🔄 Attempting connection to local MongoDB (mongodb://127.0.0.1:27017/image_app)...');
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
      console.log('✅ Connected to local MongoDB Database');
      connected = true;
    } catch (localErr) {
      console.warn('⚠️ Local MongoDB connection also failed:', localErr.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 Express Backend Server running on http://localhost:${PORT}`);
  });
};

startServer();
