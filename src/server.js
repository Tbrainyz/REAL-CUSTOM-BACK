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

// CORS - Updated with your Vercel frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://real-custom-back.vercel.app',
  
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

// Paystack webhook
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', env: process.env.NODE_ENV || 'development' });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/contacts', require('./routes/contacts'));
app.use('/messages', require('./routes/messages'));
app.use('/templates', require('./routes/templates'));
app.use('/invoices', require('./routes/invoices'));
app.use('/expenses', require('./routes/expenses'));
app.use('/inventory', require('./routes/inventory'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/payments', require('./routes/payments'));
app.use('/users', require('./routes/users'));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB Connected Successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    initScheduledJobs().catch(err => {
      console.warn('⚠️ Scheduled jobs failed:', err.message);
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();