require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initScheduledJobs } = require('./controllers/messageController');

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
  fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
}

const app = express();

// CORS Setup
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://real-custom-back.onrender.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Paystack webhook - must come before json parser
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ==================== ROUTES ====================

app.use('/auth', require('./routes/auth'));
app.use('/contacts', require('./routes/contacts'));
app.use('/messages', require('./routes/messages'));
app.use('/templates', require('./routes/templates'));

// Finance routes (Invoices + Expenses)
app.use('/invoices', require('./routes/finance'));   // ← This is correct

app.use('/inventory', require('./routes/inventory'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/payments', require('./routes/payments'));
app.use('/users', require('./routes/users'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB Connected Successfully');

    const server = app.listen(PORT, async () => {
      console.log(`\n🚀 MessagePro Server running on port ${PORT}`);
      console.log(`   Env  : ${process.env.NODE_ENV || 'development'}`);
      console.log(`   API  : http://localhost:${PORT}/api`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);

      try {
        await initScheduledJobs();
      } catch (jobError) {
        console.warn('⚠️ Scheduled jobs failed to init:', jobError.message);
      }
    });

  } catch (error) {
    console.error('❌ Server startup error:', error.message);
    process.exit(1);
  }
};

startServer();