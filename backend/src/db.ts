import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/acn';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[ACN] ✅ MongoDB connected — ${MONGO_URI}`);
  } catch (err) {
    console.error('[ACN] ❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}
