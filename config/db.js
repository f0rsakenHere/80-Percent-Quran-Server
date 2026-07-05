const mongoose = require('mongoose');
const dns = require('dns');

// Some local routers refuse DNS SRV queries, which breaks mongodb+srv:// Atlas
// lookups. Prefer public resolvers so the SRV record resolves reliably.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', ...dns.getServers()]);
} catch (_) {
  // Non-fatal: fall back to the system resolver.
}

// Cache the connection across (warm) serverless invocations. On Vercel the
// module scope is reused between requests, so we must NOT open a new pool per
// request — that exhausts Atlas' connection limit and makes later operations
// (especially writes needing a fresh socket) hang forever. We keep a single
// cached connection/promise on the global object so it survives module reload.
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

/**
 * Connect to MongoDB, reusing an existing connection when healthy.
 * Safe to call on every request — it awaits the same cached promise.
 * @returns {Promise<typeof mongoose>} Connected mongoose instance
 */
const connectDB = async () => {
  // readyState 1 = connected; anything else means we should (re)establish.
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        // Fail fast instead of buffering an operation forever when the socket
        // is dead — the root cause of the 15s client timeouts on serverless.
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 20000,
        // Small pool: many short-lived serverless instances must share Atlas'
        // connection budget without exhausting it.
        maxPoolSize: 5,
      })
      .then((m) => {
        console.log(`✅ MongoDB Connected: ${m.connection.host}`);
        return m;
      });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      // Drop the cache so the next request reconnects instead of reusing a
      // stale/half-open socket that would hang.
      cached.conn = null;
      cached.promise = null;
      console.warn('⚠️  MongoDB disconnected.');
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Allow the next request to retry; never process.exit() in serverless.
    cached.promise = null;
    console.error('❌ Error connecting to MongoDB:', error.message);
    throw error;
  }

  return cached.conn;
};

module.exports = connectDB;
