import app from './app.js';
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// If DNS is pointed at loopback with no listener (WSL/Docker), fall back to public DNS
(function ensureDns() {
  const servers = dns.getServers();
  const allLoopback = servers.every(s => s === '127.0.0.1' || s === '::1');
  if (allLoopback) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
})();

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', (reason) => {
  console.error('⚠️  Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

const server = await connectDB()
  .then(async () => {
    const srv = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
    return srv;
  })
  .catch((err) => {
    console.error('❌ Server ghoop ghoop:', err.message);
    process.exit(1);
  });

function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  if (!server) return process.exit(0);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    }).catch((err) => {
      console.error('❌ Error closing MongoDB:', err.message);
      process.exit(1);
    });
  });
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
