import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/image_app';

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 5000 });
      isConnected = true;
      console.log('✅ Successfully connected to MongoDB Database');
      return;
    } catch (err) {
      console.warn('⚠️ Primary MongoDB connection failed:', err.message);
    }
  }

  if (!isConnected && primaryUri !== localUri) {
    try {
      console.log('🔄 Attempting connection to local MongoDB (mongodb://127.0.0.1:27017/image_app)...');
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
      isConnected = true;
      console.log('✅ Connected to local MongoDB Database');
    } catch (localErr) {
      console.warn('⚠️ Local MongoDB connection failed:', localErr.message);
    }
  }
};
