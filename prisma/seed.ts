import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Build connection string from env vars (Railway: DATABASE_URL, local: individual vars)
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}?schema=public`;

// Setup Prisma client with pg adapter
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...\n');

  // ─── Seed Admin User ────────────────────────────────────────
  const adminEmail = 'rizkyarm1711@gmail.com';
  const adminPassword = await bcrypt.hash('Rizkyar1801', SALT_ROUNDS);

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
