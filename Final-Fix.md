# 🔧 Final-Fix: Deployment `all-backend` ke Supabase

> **Tanggal Audit:** 9 Juni 2026  
> **Status:** Belum siap deploy — 4 masalah kritis, 4 menengah, 5 minor  
> **Target:** Supabase sebagai backend utama manajemen project & portfolio

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Saat Ini vs Target Supabase](#2-arsitektur-saat-ini-vs-target-supabase)
3. [🔴 Masalah Kritis — Wajib Diperbaiki](#3--masalah-kritis--wajib-diperbaiki)
   - [3.1 Redis Tidak Disediakan Supabase](#31-redis-tidak-disediakan-supabase)
   - [3.2 Storage: Migrasi MinIO → Supabase Storage](#32-storage-migrasi-minio--supabase-storage)
   - [3.3 Environment Variables Supabase](#33-environment-variables-supabase)
   - [3.4 Docker Compose & Dockerfile untuk Supabase](#34-docker-compose--dockerfile-untuk-supabase)
4. [🟡 Masalah Menengah — Sangat Direkomendasikan](#4--masalah-menengah--sangat-direkomendasikan)
   - [4.1 Rate Limiting Belum Diimplementasikan](#41-rate-limiting-belum-diimplementasikan)
   - [4.2 Anti-Spam pada Public Contact Form](#42-anti-spam-pada-public-contact-form)
   - [4.3 CORS Production Terlalu Longgar](#43-cors-production-terlalu-longgar)
   - [4.4 Email Hanya Simulasi](#44-email-hanya-simulasi)
5. [🟢 Masalah Minor — Nice-to-Have](#5--masalah-minor--nice-to-have)
   - [5.1 Paginasi pada GET /projects](#51-paginasi-pada-get-projects)
   - [5.2 HTTPS Enforcement](#52-https-enforcement)
   - [5.3 bcrypt Salt Rounds Hardcoded](#53-bcrypt-salt-rounds-hardcoded)
   - [5.4 AdminAuthController.logout() Tanpa Auth Guard](#54-adminauthcontrollerlogout-tanpa-auth-guard)
   - [5.5 Tidak Ada Unit Test](#55-tidak-ada-unit-test)
6. [📋 Checklist Eksekusi Perbaikan](#6--checklist-eksekusi-perbaikan)
7. [📊 Struktur Route Lengkap](#7--struktur-route-lengkap)
8. [📦 Daftar File yang Perlu Diubah](#8--daftar-file-yang-perlu-diubah)

---

## 1. Ringkasan Eksekutif

Project `all-backend` adalah NestJS monolith dengan kualitas kode yang **sangat baik** — arsitektur modular, JWT auth dengan rotation, RBAC, observability, dan portfolio CRUD lengkap. Namun, project ini didesain untuk **self-hosted deployment** (Docker Compose dengan PostgreSQL, Redis, MinIO lokal). Supabase menggantikan PostgreSQL dan Storage, tetapi **tidak menyediakan Redis**.

**Estimasi total waktu perbaikan:** 4–8 jam (tergantung setup Redis eksternal & Supabase Storage).

---

## 2. Arsitektur Saat Ini vs Target Supabase

```mermaid
graph TD
    subgraph "Saat Ini (Self-Hosted)"
        A[NestJS API] --> B[(PostgreSQL Container)]
        A --> C[(Redis Container)]
        A --> D[(MinIO Container)]
    end

    subgraph "Target (Supabase)"
        E[NestJS API] --> F[(Supabase PostgreSQL)]
        E --> G[(Upstash / Redis Cloud)]
        E --> H[(Supabase Storage S3)]
    end

    style B fill:#f96,stroke:#333
    style C fill:#f96,stroke:#333
    style D fill:#f96,stroke:#333
    style F fill:#9f6,stroke:#333
    style G fill:#ff9,stroke:#333
    style H fill:#9f6,stroke:#333
```

| Layanan | Self-Hosted Saat Ini | Supabase Target |
|---------|---------------------|-----------------|
| Database | PostgreSQL Container | ✅ Supabase PostgreSQL (gratis) |
| Storage | MinIO Container | ✅ Supabase Storage (S3-compatible) |
| Redis | Redis Container | ❌ **Perlu eksternal** (Upstash / Redis Cloud) |
| API | NestJS Container | ✅ Deploy ke Railway / Fly.io / VPS |

---

## 3. 🔴 Masalah Kritis — Wajib Diperbaiki

### 3.1 Redis Tidak Disediakan Supabase

**File terdampak:** `src/redis/redis.service.ts`, `src/app.module.ts`, `src/auth/auth.service.ts`, `src/cron/cron.module.ts`

**Masalah:** Project menggunakan Redis untuk 3 fungsi vital:
- BullMQ job queue (email, notifikasi)
- Token blacklist (saat logout & refresh token rotation)
- Caching refresh token hash

Tanpa Redis, aplikasi akan **crash saat startup** (BullModule gagal connect).

#### Solusi: Gunakan Upstash Redis (Gratis 256 MB)

**Langkah 1:** Buat akun di [Upstash](https://upstash.com/) → Create Redis Database → pilih region terdekat → copy `UPSTASH_REDIS_URL`.

**Langkah 2:** Update `.env`:

```env
# Hapus / komentari:
# REDIS_HOST=localhost
# REDIS_PORT=6379

# Tambahkan:
REDIS_URL=redis://default:your-upstash-password@your-upstash-host.upstash.io:6379
REDIS_HOST=your-upstash-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password
REDIS_TLS=true
```

**Langkah 3:** Update `src/redis/redis.service.ts` agar support TLS:

```typescript
// src/redis/redis.service.ts
import Redis from 'ioredis';

// Dalam constructor:
const isTls = this.configService.get<string>('REDIS_TLS') === 'true';
this.client = new Redis({
  host: this.configService.get<string>('REDIS_HOST'),
  port: this.configService.get<number>('REDIS_PORT'),
  password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
  ...(isTls ? { tls: {} } : {}),
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: null, // Diperlukan BullMQ
});
```

**Langkah 4:** Update `src/app.module.ts` — BullModule factory untuk support password & TLS:

```typescript
// src/app.module.ts — dalam BullModule.forRootAsync
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const isTls = configService.get<string>('REDIS_TLS') === 'true';
    return {
      connection: {
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT'),
        password: configService.get<string>('REDIS_PASSWORD') || undefined,
        ...(isTls ? { tls: {} } : {}),
      },
    };
  },
}),
```

**Langkah 5:** Update `env.validation.ts`:

```typescript
// src/config/env.validation.ts — tambahkan di Joi schema:
REDIS_URL: Joi.string().optional(),
REDIS_PASSWORD: Joi.string().optional(),
REDIS_TLS: Joi.string().optional().default('false'),
```

---

### 3.2 Storage: Migrasi MinIO → Supabase Storage

**File terdampak:** `src/storage/storage.service.ts`

**Masalah:** `StorageService` mengarah ke MinIO lokal (`http://localhost:9000`). Supabase Storage adalah S3-compatible dengan endpoint berbeda dan autentikasi berbasis service key.

#### Solusi: Update S3Client ke Supabase Storage Endpoint

**Langkah 1:** Buat bucket di [Supabase Dashboard](https://app.supabase.com) → Storage → New Bucket → `my-bucket` (public atau private).

**Langkah 2:** Dapatkan credentials dari Supabase Dashboard → Project Settings → API:
- `Project URL`: `https://<project-ref>.supabase.co`
- `Service Role Key` (secret): digunakan sebagai `MINIO_SECRET_KEY`

**Langkah 3:** Update `.env`:

```env
# Supabase Storage (menggantikan MinIO)
MINIO_ENDPOINT=<project-ref>.supabase.co
MINIO_PORT=443
MINIO_ACCESS_KEY=<project-ref>                    # Supabase project reference
MINIO_SECRET_KEY=<supabase-service-role-key>       # rahasiakan!
MINIO_BUCKET_NAME=my-bucket
MINIO_PUBLIC_ENDPOINT=<project-ref>.supabase.co
MINIO_PUBLIC_PORT=443
MINIO_USE_SSL=true                                 # ⬅️ BARU!
```

**Langkah 4:** Update `src/storage/storage.service.ts`:

```typescript
// src/storage/storage.service.ts
constructor(private configService: ConfigService) {
  const endpoint = this.configService.get<string>('MINIO_ENDPOINT')!;
  const port = this.configService.get<number>('MINIO_PORT');
  const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY')!;
  const secretKey = this.configService.get<string>('MINIO_SECRET_KEY')!;
  this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME')!;
  const useSsl = this.configService.get<string>('MINIO_USE_SSL') === 'true';

  const protocol = useSsl ? 'https' : 'http';

  const baseConfig = {
    region: 'us-east-1' as const,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true as const,            // Supabase Storage perlu ini
    ...(useSsl ? {} : {}),
  };

  // Internal client: untuk upload / delete / bucket management
  this.s3Client = new S3Client({
    ...baseConfig,
    endpoint: `${protocol}://${endpoint}${port && port !== 443 && port !== 80 ? `:${port}` : ''}/storage/v1/s3`,
  });

  // Public client: untuk presigned URL
  const publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT') || endpoint;
  const publicPort = this.configService.get<number>('MINIO_PUBLIC_PORT') || port;
  this.s3PublicClient = new S3Client({
    ...baseConfig,
    endpoint: `${protocol}://${publicEndpoint}${publicPort && publicPort !== 443 && publicPort !== 80 ? `:${publicPort}` : ''}/storage/v1/s3`,
  });
}
```

> ⚠️ **Penting:** Endpoint Supabase S3 menggunakan path `/storage/v1/s3`. Bucket harus sudah dibuat via Supabase Dashboard terlebih dahulu — S3 API `CreateBucketCommand` mungkin tidak berfungsi di Supabase Storage (tergantung permission).

**Langkah 5:** Update `onModuleInit()` — skip auto-create bucket untuk Supabase (tidak selalu didukung):

```typescript
async onModuleInit() {
  this.logger.log(`StorageService initialized. Checking bucket: ${this.bucketName}`);
  try {
    await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    this.logger.log(`Bucket '${this.bucketName}' is ready.`);
  } catch (error: unknown) {
    const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
      // Supabase: bucket harus dibuat manual via dashboard
      this.logger.warn(
        `Bucket '${this.bucketName}' not found. Please create it manually in Supabase Dashboard → Storage.`,
      );
    } else {
      this.logger.error(`Error checking bucket: ${(error as Error).message}`);
    }
  }
}
```

---

### 3.3 Environment Variables Supabase

**File terdampak:** `.env`, `.env.example`, `.env.production`, `src/config/env.validation.ts`

**Masalah:** Semua env vars mengarah ke localhost dan credentials development.

#### Solusi: Buat `.env.supabase` template

Buat file baru `.env.supabase`:

```env
# ================================
# Supabase Production Environment
# ================================
NODE_ENV=production
PORT=3000

# Supabase PostgreSQL (dari Dashboard → Settings → Database → Connection string)
DB_HOST=db.<project-ref>.supabase.co
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<database-password-from-supabase>
DB_DATABASE=postgres
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?schema=public

# JWT (generate: openssl rand -hex 64)
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Upstash Redis
REDIS_URL=redis://default:<password>@<host>.upstash.io:6379
REDIS_HOST=<host>.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=<upstash-password>
REDIS_TLS=true

# Supabase Storage (S3-compatible)
MINIO_ENDPOINT=<project-ref>.supabase.co
MINIO_PORT=443
MINIO_ACCESS_KEY=<project-ref>
MINIO_SECRET_KEY=<service-role-key>
MINIO_BUCKET_NAME=my-bucket
MINIO_PUBLIC_ENDPOINT=<project-ref>.supabase.co
MINIO_PUBLIC_PORT=443
MINIO_USE_SSL=true

# Frontend CORS
FRONTEND_URL=https://your-portfolio-domain.com
```

Update `src/config/env.validation.ts`:

```typescript
// Tambahkan field baru:
REDIS_URL: Joi.string().optional(),
REDIS_PASSWORD: Joi.string().optional(),
REDIS_TLS: Joi.string().optional().default('false'),
MINIO_USE_SSL: Joi.string().optional().default('false'),
```

---

### 3.4 Docker Compose & Dockerfile untuk Supabase

**File terdampak:** `docker-compose.prod.yml`, `Dockerfile`

**Masalah:** Docker compose menyertakan PostgreSQL, Redis, dan MinIO container — tidak diperlukan jika pakai Supabase.

#### Solusi: Buat `docker-compose.supabase.yml`

```yaml
# docker-compose.supabase.yml
# Hanya API NestJS — Database & Storage ditangani Supabase, Redis oleh Upstash
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: all-backend-api
    restart: always
    ports:
      - '3000:3000'
    env_file:
      - .env.supabase
    command: sh -c "npx prisma migrate deploy && node dist/main.js"
```

> **Catatan:** `npx prisma migrate deploy` akan menjalankan migrasi langsung ke database Supabase. Pastikan `DATABASE_URL` di `.env.supabase` benar.

---

## 4. 🟡 Masalah Menengah — Sangat Direkomendasikan

### 4.1 Rate Limiting Belum Diimplementasikan

**File:** `src/app.module.ts`

**Masalah:** `@nestjs/throttler` sudah di `package.json` tapi `ThrottlerModule` tidak di-register.

#### Solusi:

```typescript
// src/app.module.ts — tambahkan import
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Di dalam @Module imports:
ThrottlerModule.forRoot([{
  ttl: 60000,    // 1 menit window
  limit: 20,     // 20 requests per window
}]),

// Di dalam @Module providers:
{
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
},
```

Override rate limit di endpoint sensitif:

```typescript
// src/auth/auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { ttl: 60000, limit: 5 } })  // 5 req/menit
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### 4.2 Anti-Spam pada Public Contact Form

**File:** `src/portfolio/messages/messages.controller.ts`

**Masalah:** `POST /messages` terbuka tanpa proteksi spam.

#### Solusi: Tambahkan rate limit + validasi ketat

```typescript
// src/portfolio/messages/messages.controller.ts
import { Throttle } from '@nestjs/throttler';

@Post()
@Throttle({ default: { ttl: 60000, limit: 2 } })  // Max 2 msg/menit
create(@Body() dto: CreateMessageDto) {
  return this.messagesService.create(dto);
}
```

### 4.3 CORS Production Terlalu Longgar

**File:** `docker-compose.prod.yml`, `src/main.ts`

**Masalah:** `FRONTEND_URL=*` di docker compose production.

#### Solusi:

Set `FRONTEND_URL` ke domain spesifik di `.env.supabase`:

```env
FRONTEND_URL=https://your-portfolio-domain.com,https://www.your-portfolio-domain.com
```

### 4.4 Email Hanya Simulasi

**File:** `src/email/email.processor.ts`, `src/notifications/notifications.processor.ts`

**Masalah:** Email processor hanya log `[SIMULATION]`, tidak benar-benar mengirim.

#### Solusi: Integrasi dengan Resend (gratis 100 email/hari)

```bash
npm install resend
```

```typescript
// src/email/email.processor.ts
import { Resend } from 'resend';

private resend = new Resend(process.env.RESEND_API_KEY);

private async handleSendEmail(data: SendEmailPayload) {
  const { data: result, error } = await this.resend.emails.send({
    from: 'Portfolio <noreply@yourdomain.com>',
    to: [data.to],
    subject: data.subject,
    html: `<h1>Welcome!</h1><p>Hello ${data.context?.name}</p>`,
  });

  if (error) {
    this.logger.error(`Email failed: ${error.message}`);
    throw error;
  }
  this.logger.log(`Email sent: ${result?.id}`);
}
```

---

## 5. 🟢 Masalah Minor — Nice-to-Have

### 5.1 Paginasi pada GET /projects

**File:** `src/portfolio/projects/projects.controller.ts`, `src/portfolio/projects/projects.service.ts`

**Masalah:** `findAll()` dan `findAllPublic()` tidak pakai paginasi — bisa return ribuan record.

#### Solusi:

```typescript
// src/portfolio/projects/projects.service.ts
async findAllPublic(query: QueryProjectDto) {
  const page = query.page || 1;
  const limit = query.limit || 12;

  const [projects, total] = await Promise.all([
    this.prisma.client.project.findMany({
      where,
      orderBy: { order: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.client.project.count({ where }),
  ]);

  return {
    data: this.transformProjects(projects),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
```

### 5.2 HTTPS Enforcement

**File:** `src/main.ts`

#### Solusi: Tambahkan (opsional, Railway/Fly.io handle HTTPS):

```typescript
// Jika deploy ke VPS bare:
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

### 5.3 bcrypt Salt Rounds Hardcoded

**File:** `src/auth/auth.service.ts`, `src/users/users.service.ts`, `prisma/seed.ts`

**Masalah:** `SALT_ROUNDS = 10` hardcoded di 3 file berbeda.

#### Solusi:

```typescript
// Ambil dari config:
private readonly saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 12;
```

Tambahkan ke `.env` dan `env.validation.ts`:

```env
BCRYPT_SALT_ROUNDS=12
```

### 5.4 AdminAuthController.logout() Tanpa Auth Guard

**File:** `src/auth/admin-auth.controller.ts`

**Masalah:** `POST /admin/logout` tidak punya `@Public()` dan tidak punya explicit guard — tapi karena `JwtAuthGuard` adalah global APP_GUARD, route ini sebenarnya **sudah terproteksi JWT**. Hanya saja tidak ada `@ApiBearerAuth()` di decorator class level (sudah ada).

**Status:** ✅ Sebenarnya sudah aman (global guard bekerja). Tidak ada tindakan diperlukan.

### 5.5 Tidak Ada Unit Test

**File:** `test/app.e2e-spec.ts` (hanya skeleton)

**Rekomendasi:** Tambahkan minimal unit test untuk:
- `AuthService.register()` & `AuthService.login()`
- `ProjectsService.create()`
- `MessagesService.create()`

```bash
npm run test -- --testPathPattern="auth.service"
```

---

## 6. 📋 Checklist Eksekusi Perbaikan

Urutan pengerjaan rekomendasi (dari kritis ke minor):

### Fase 1: Infrastruktur (1–3 jam)

- [ ] **1.1** Buat akun Upstash Redis, dapatkan `REDIS_URL`
- [ ] **1.2** Update `src/redis/redis.service.ts` — support TLS & password
- [ ] **1.3** Update `src/app.module.ts` — BullModule factory support TLS
- [ ] **1.4** Update `src/config/env.validation.ts` — tambahkan field Redis baru
- [ ] **1.5** Buat bucket di Supabase Storage Dashboard
- [ ] **1.6** Update `src/storage/storage.service.ts` — endpoint Supabase + skip auto-create bucket
- [ ] **1.7** Dapatkan Supabase DB connection string & service role key
- [ ] **1.8** Buat `.env.supabase` dengan semua credentials production
- [ ] **1.9** Buat `docker-compose.supabase.yml` (API only)
- [ ] **1.10** Test koneksi database: `npx prisma migrate deploy`

### Fase 2: Keamanan (30 mnt–1 jam)

- [ ] **2.1** Implementasi `ThrottlerModule` + `ThrottlerGuard` global
- [ ] **2.2** Tambahkan rate limit di `POST /auth/login`, `POST /auth/register`, `POST /messages`
- [ ] **2.3** Set `FRONTEND_URL` ke domain spesifik di production
- [ ] **2.4** Generate JWT secrets baru: `openssl rand -hex 64`

### Fase 3: Email & Polish (1–2 jam)

- [ ] **3.1** Integrasi Resend/SendGrid untuk email production
- [ ] **3.2** Tambahkan paginasi di `GET /projects`
- [ ] **3.3** Pindahkan `SALT_ROUNDS` ke config environment
- [ ] **3.4** Setup CI/CD (GitHub Actions → Railway/Fly.io)

### Fase 4: Testing (opsional, 2–4 jam)

- [ ] **4.1** Tulis unit test untuk service kritis
- [ ] **4.2** Smoke test semua endpoint production
- [ ] **4.3** Test rate limiting
- [ ] **4.4** Test refresh token flow

---

## 7. 📊 Struktur Route Lengkap

| # | Method | Route | Auth | Controller | Deskripsi |
|---|--------|-------|------|------------|-----------|
| 1 | `GET` | `/api/v1/` | Public | `AppController` | Status check |
| 2 | `GET` | `/api/v1/health` | Public | `HealthController` | Health checks (DB, Redis, Memory, Disk) |
| 3 | `POST` | `/api/v1/auth/register` | Public | `AuthController` | Register user baru |
| 4 | `POST` | `/api/v1/auth/login` | Public | `AuthController` | Login, return tokens |
| 5 | `POST` | `/api/v1/auth/refresh` | Public | `AuthController` | Refresh access token |
| 6 | `POST` | `/api/v1/auth/logout` | Public | `AuthController` | Logout, revoke refresh token |
| 7 | `GET` | `/api/v1/auth/me` | Optional | `AuthController` | Current user (null jika tidak login) |
| 8 | `GET` | `/api/v1/admin/me` | Optional | `AdminAuthController` | Admin current user |
| 9 | `POST` | `/api/v1/admin/logout` | JWT | `AdminAuthController` | Admin logout |
| 10 | `GET` | `/api/v1/users/me` | JWT | `UsersController` | Get profile |
| 11 | `PATCH` | `/api/v1/users/me` | JWT | `UsersController` | Update profile |
| 12 | `GET` | `/api/v1/users` | ADMIN | `UsersController` | List all users (paginated) |
| 13 | `PATCH` | `/api/v1/users/:id/role` | ADMIN | `UsersController` | Assign role ke user |
| 14 | `POST` | `/api/v1/files/upload` | JWT | `FilesController` | Upload file (png/jpg/pdf, max 5MB) |
| 15 | `DELETE` | `/api/v1/files/:key` | JWT | `FilesController` | Delete file (owner only) |
| 16 | `GET` | `/api/v1/files/:key/url` | JWT | `FilesController` | Get presigned URL |
| 17 | `GET` | `/api/v1/projects` | Public | `ProjectsController` | List projects (filter: category, search, featured) |
| 18 | `GET` | `/api/v1/projects/:slugOrId` | Public | `ProjectsController` | Get project by slug or ID |
| 19 | `GET` | `/api/v1/admin/projects` | ADMIN | `AdminProjectsController` | Admin list projects |
| 20 | `GET` | `/api/v1/admin/projects/:id` | ADMIN | `AdminProjectsController` | Admin get project |
| 21 | `POST` | `/api/v1/admin/projects` | ADMIN | `AdminProjectsController` | Create project (+ upload thumbnail & images) |
| 22 | `PUT` | `/api/v1/admin/projects/:id` | ADMIN | `AdminProjectsController` | Update project |
| 23 | `DELETE` | `/api/v1/admin/projects/:id` | ADMIN | `AdminProjectsController` | Delete project |
| 24 | `GET` | `/api/v1/skills` | Public | `SkillsController` | List visible skills |
| 25 | `GET` | `/api/v1/admin/skills` | ADMIN | `AdminSkillsController` | Admin list skills |
| 26 | `POST` | `/api/v1/admin/skills` | ADMIN | `AdminSkillsController` | Create skill |
| 27 | `PUT` | `/api/v1/admin/skills/:id` | ADMIN | `AdminSkillsController` | Update skill |
| 28 | `DELETE` | `/api/v1/admin/skills/:id` | ADMIN | `AdminSkillsController` | Delete skill |
| 29 | `GET` | `/api/v1/services` | Public | `ServicesController` | List visible services |
| 30 | `GET` | `/api/v1/admin/services` | ADMIN | `AdminServicesController` | Admin list services |
| 31 | `POST` | `/api/v1/admin/services` | ADMIN | `AdminServicesController` | Create service |
| 32 | `PUT` | `/api/v1/admin/services/:id` | ADMIN | `AdminServicesController` | Update service |
| 33 | `DELETE` | `/api/v1/admin/services/:id` | ADMIN | `AdminServicesController` | Delete service |
| 34 | `GET` | `/api/v1/profile` | Public | `ProfileController` | Get profile |
| 35 | `GET` | `/api/v1/admin/profile` | ADMIN | `AdminProfileController` | Admin get profile |
| 36 | `PUT` | `/api/v1/admin/profile` | ADMIN | `AdminProfileController` | Update profile (+ upload avatar) |
| 37 | `POST` | `/api/v1/messages` | Public | `MessagesController` | Send contact message |
| 38 | `GET` | `/api/v1/admin/messages` | ADMIN | `AdminMessagesController` | List messages |
| 39 | `PUT` | `/api/v1/admin/messages/:id/read` | ADMIN | `AdminMessagesController` | Mark message as read |
| 40 | `DELETE` | `/api/v1/admin/messages/:id` | ADMIN | `AdminMessagesController` | Delete message |
| 41 | `GET` | `/api/v1/queues` | — | Bull Board | BullMQ dashboard UI |
| 42 | `GET` | `/api/v1/api/docs` | — | Swagger | API docs (non-production only) |

---

## 8. 📦 Daftar File yang Perlu Diubah

### Fase 1: Infrastruktur

| # | File | Perubahan |
|---|------|-----------|
| 1 | `src/redis/redis.service.ts` | Support TLS, password, retry strategy |
| 2 | `src/app.module.ts` | BullModule factory TLS support |
| 3 | `src/config/env.validation.ts` | Tambah `REDIS_URL`, `REDIS_PASSWORD`, `REDIS_TLS`, `MINIO_USE_SSL` |
| 4 | `src/storage/storage.service.ts` | Endpoint Supabase Storage, skip auto-create bucket, HTTPS |
| 5 | `.env.supabase` | **BARU** — semua env vars untuk Supabase production |
| 6 | `docker-compose.supabase.yml` | **BARU** — API-only compose file |
| 7 | `.env.example` | Update dengan template Supabase |
| 8 | `.env` | Update dengan credentials Supabase/Upstash |

### Fase 2: Keamanan

| # | File | Perubahan |
|---|------|-----------|
| 9 | `src/app.module.ts` | Tambah `ThrottlerModule` + `ThrottlerGuard` |
| 10 | `src/auth/auth.controller.ts` | `@Throttle()` di login & register |
| 11 | `src/portfolio/messages/messages.controller.ts` | `@Throttle()` di create |

### Fase 3: Email & Polish

| # | File | Perubahan |
|---|------|-----------|
| 12 | `src/email/email.processor.ts` | Integrasi Resend/SMTP |
| 13 | `src/notifications/notifications.processor.ts` | Integrasi Resend/SMTP |
| 14 | `src/portfolio/projects/projects.service.ts` | Paginasi di `findAllPublic` |
| 15 | `src/auth/auth.service.ts` | `SALT_ROUNDS` dari config |
| 16 | `src/users/users.service.ts` | `SALT_ROUNDS` dari config |
| 17 | `prisma/seed.ts` | `SALT_ROUNDS` dari config |

### Fase 4: Testing (opsional)

| # | File | Perubahan |
|---|------|-----------|
| 18 | `src/auth/auth.service.spec.ts` | **BARU** — unit test auth |
| 19 | `src/portfolio/projects/projects.service.spec.ts` | **BARU** — unit test projects |

---

> **Catatan Akhir:** Project ini memiliki kualitas kode yang baik. Setelah 4 masalah kritis di Fase 1 diselesaikan, project sudah bisa di-deploy ke Supabase dan berfungsi sebagai backend production. Fase 2–4 adalah peningkatan keamanan dan kualitas untuk production readiness penuh.
