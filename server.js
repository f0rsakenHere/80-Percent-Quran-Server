require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import configurations
const connectDB = require('./config/db');
const initializeFirebase = require('./config/firebase');

// Import routes
const wordRoutes = require('./routes/wordRoutes');
const progressRoutes = require('./routes/progressRoutes');
const quranRoutes = require('./routes/quranRoutes');
const storyRoutes = require('./routes/storyRoutes');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Behind a reverse proxy (Vercel / nginx): trust the first proxy hop so the
// rate limiter keys on the real client IP instead of collapsing every user
// into the proxy's single IP bucket.
app.set('trust proxy', 1);

// Environment variables validation
// NOTE: Quran content is now served from bundled local data (data/quran/),
// so the Quran Foundation API credentials (QF_*) are no longer required.
const requiredEnvVars = [
  'MONGO_URI',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

// Check for at least one Firebase config
if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_CONFIG_JSON) {
  missingEnvVars.push('FIREBASE_CONFIG_JSON (or FIREBASE_SERVICE_ACCOUNT)');
}

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Initialize Database and Firebase. The DB connect is best-effort here (warms
// the cold start); each API request also awaits the cached connection below.
// The .catch keeps a transient connect failure from tripping the
// unhandledRejection handler and killing the serverless function.
connectDB().catch((e) => console.error('Initial DB connect failed:', e.message));
initializeFirebase();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 CORS Blocked Origin:', origin);
      console.log('✅ Allowed Origins:', allowedOrigins); // Debug log
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
// A single page (e.g. the Reader paginating verses) can make several requests,
// so the per-window cap needs headroom. Configurable via RATE_LIMIT_MAX.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Ensure a live DB connection before any data route runs. With
// bufferCommands:false, queries issued before connect would throw instead of
// hanging — so we await the cached connection here and fail fast with 503 if
// the database is genuinely unreachable.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database temporarily unavailable' });
  }
});

// API Routes
app.use('/api/words', wordRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/quran', quranRoutes);
app.use('/api/stories', storyRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║      Vocabulary API Server                                                ║
║                                                                           ║
║      Port: ${PORT.toString().padEnd(43)}                                  ║
║      Environment: ${(process.env.NODE_ENV || 'development').padEnd(38)}   ║
║      Quran API: ${(process.env.QF_ENV || 'prelive').padEnd(40)}           ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
