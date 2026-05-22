require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { initScheduledJobs } = require('./controllers/messageController');

// Ensure uploads dir exists
if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
  fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
}

const app = express();

// Connect DB
connectDB();

// Security & Parsing
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Paystack webhook needs raw body — must be before express.json()
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/contacts',   require('./routes/contacts'));
app.use('/api/messages',   require('./routes/messages'));
app.use('/api/templates',  require('./routes/templates'));
app.use('/api',            require('./routes/finance'));      // mounts /api/invoices + /api/expenses
app.use('/api/inventory',  require('./routes/inventory'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/users',      require('./routes/users'));

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`\n🚀 MessagePro Server running on port ${PORT}`);
  console.log(`   Env  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API  : http://localhost:${PORT}/api`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  await initScheduledJobs();
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = app;
