const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/fiberhomemanage';

    const options = {
      autoIndex: !isProduction,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
      serverSelectionTimeoutMS: Number(
        process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000
      ),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
      maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000),
    };

    const conn = await mongoose.connect(mongoUri, options);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    return conn;
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDatabase;
