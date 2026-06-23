import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'provision')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database — use DATABASE_URL (Railway/Supabase) or individual vars (local Docker)
  DATABASE_URL: Joi.string().optional().allow(''),
  DB_HOST: Joi.string().optional().allow(''),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().optional().allow(''),
  DB_PASSWORD: Joi.string().optional().allow(''),
  DB_DATABASE: Joi.string().optional().allow(''),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // Redis — use REDIS_URL (Upstash) or REDIS_HOST+PORT (local Docker)
  REDIS_URL: Joi.string().optional().allow(''),
  REDIS_HOST: Joi.string().optional().allow(''),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_TLS: Joi.string().optional().allow('').default('false'),

  // Storage (MinIO / Supabase S3)
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_PUBLIC_ENDPOINT: Joi.string().optional(),
  MINIO_PUBLIC_PORT: Joi.number().optional(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET_NAME: Joi.string().required(),
  MINIO_USE_SSL: Joi.string().optional().default('false'),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: Joi.number().optional().default(12),

  // Frontend
  FRONTEND_URL: Joi.string().optional().default('*'),
});
