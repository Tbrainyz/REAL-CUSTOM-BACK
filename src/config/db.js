const mongoose = require('mongoose');

const connectDB = async () => {
  console.log('⏳ Attempting to connect to MongoDB Atlas...');
  
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
  } catch (err) {
    console.error('❌ MongoDB Connection Failed');
    console.error('Error Message:', err.message);
    
    if (err.message.includes('whitelist') || err.message.includes('IP')) {
      console.error('🔴 FIX: Add 0.0.0.0/0 in MongoDB Atlas > Network Access');
    } else if (err.message.includes('Authentication failed')) {
      console.error('🔴 FIX: Wrong username or password in MONGODB_URI');
    } else if (err.message.includes('timeout')) {
      console.error('🔴 FIX: Check your internet or Atlas cluster status');
    } else {
      console.error('Full Error:', err);
    }
    
    process.exit(1);
  }
};

module.exports = connectDB;