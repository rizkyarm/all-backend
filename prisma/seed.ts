import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Build connection string from env vars
const { DB_USERNAME, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = process.env;
const connectionString = `postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}?schema=public`;

// Setup Prisma client with pg adapter
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...\n');

  // ─── Seed Admin User ────────────────────────────────────────
  const adminEmail = 'admin@example.com';
  const adminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminPassword,
      name: 'Super Admin',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email} (${admin.role})`);

  // ─── Seed Regular User ─────────────────────────────────────
  const userEmail = 'user@example.com';
  const userPassword = await bcrypt.hash('User@123', SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: userEmail },
    update: {},
    create: {
      email: userEmail,
      password: userPassword,
      name: 'Regular User',
      role: 'USER',
    },
  });
  console.log(`✅ Regular user seeded: ${user.email} (${user.role})`);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
