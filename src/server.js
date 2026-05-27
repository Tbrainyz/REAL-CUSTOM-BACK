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

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://real-customer.vercel.app',        // Frontend
  'https://real-custom-back.onrender.com',   // Backend itself
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`❌ CORS Blocked Origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Handle preflight requests
app.options('*', cors());

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
  res.json({ 
    status: 'OK', 
    env: process.env.NODE_ENV,
    allowed_origins: allowedOrigins 
  });
});

// Routes - IMPORTANT: Add /api prefix if your frontend expects it
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.originalUrl} not found` 
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB Connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend Allowed: https://real-customer.vercel.app`);
    });

    initScheduledJobs().catch(err => console.warn('Scheduled jobs warning:', err.message));
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};

startServer();