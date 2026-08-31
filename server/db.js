import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  const primaryUri = process.env.MONGODB_URI;
  const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      isConnected = true;
      console.log('✅ Successfully connected to MongoDB Database');
      return true;
    } catch (err) {
      console.error('⚠️ MongoDB Atlas connection failed:', err.message);
      isConnected = false;
      return false;
    }
  }

  if (isVercel) {
    console.error('⚠️ MONGODB_URI environment variable is not configured in Vercel project settings!');
    isConnected = false;
    return false;
  }

  const localUri = 'mongodb://127.0.0.1:27017/image_app';
  try {
    console.log('🔄 Attempting connection to local MongoDB (mongodb://127.0.0.1:27017/image_app)...');
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    isConnected = true;
    console.log('✅ Connected to local MongoDB Database');
    return true;
  } catch (localErr) {
    console.warn('⚠️ Local MongoDB connection failed:', localErr.message);
    isConnected = false;
    return false;
  }
};
