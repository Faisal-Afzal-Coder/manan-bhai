const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker',
      {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      }
    );
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.log(`[Database Notice]: MongoDB not connected (${error.message}). Using resilient local JSON store.`);
    return false;
  }
};

module.exports = connectDB;
