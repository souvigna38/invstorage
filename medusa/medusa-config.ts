import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      ssl: false,
    },
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || 'http://localhost:3000',
      adminCors: process.env.ADMIN_CORS || 'http://localhost:3000,http://localhost:9500',
      authCors: process.env.AUTH_CORS || 'http://localhost:3000,http://localhost:9500',
      jwtSecret: process.env.JWT_SECRET || 'invstorage-medusa-jwt-secret-2026',
      cookieSecret: process.env.COOKIE_SECRET || 'invstorage-medusa-cookie-secret-2026',
    },
  },
  admin: {
    // Admin dashboard served from /app on the same server
    // backendUrl is only needed when admin is on a different origin
  },
})
