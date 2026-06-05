// Required environment variables list
const requiredVariables = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "REDIS_URL",
  "IDEMPOTENCY_TTL_SECONDS",
];

// Verify all required environment variables exist
for (const varName of requiredVariables) {
  if (!process.env[varName]) {
    console.error(`FATAL: Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

// Ensure secret is strong enough
if ((process.env.JWT_SECRET || "").length < 32) {
  console.error("FATAL: JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

// Structured configuration object
const env = {
  port: parseInt(process.env.PORT!, 10),
  db: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN!,
  },
  redisUrl: process.env.REDIS_URL!,
  idempotencyTtlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS!, 10),
};

module.exports = env;