import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import Admin from '../models/admin.model.js';
import connectDB from '../config/db.js';

dotenv.config();

// If DNS is pointed at loopback with no listener (WSL/Docker), fall back to public DNS
// (same workaround as src/server.js)
(function ensureDns() {
  const servers = dns.getServers();
  const allLoopback = servers.every(s => s === '127.0.0.1' || s === '::1');
  if (allLoopback) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
})();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_FULL_NAME = (process.env.ADMIN_FULL_NAME || 'System Administrator').trim();

const run = async () => {
  await connectDB();
  console.log(`📦 Targeting database: ${mongoose.connection.name}`);

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment (.env).');
    await mongoose.connection.close();
    process.exit(1);
  }

  const existing = await Admin.findOne({ email: ADMIN_EMAIL, role: 'admin' });
  if (existing) {
    console.log(`✅ Admin already exists for ${ADMIN_EMAIL}. Skipping creation.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  const admin = new Admin({
    fullName: ADMIN_FULL_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
    isActive: true,
  });

  await admin.save();
  console.log(`✅ Admin created for ${ADMIN_EMAIL} with role "admin".`);
  console.log('✅ Admin password hashed using the existing bcrypt mechanism.');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('❌ Seeder failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});