import { fileURLToPath } from 'node:url'
import path from 'node:path'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]
  return value ? value : undefined
}

const tickstreamRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const dataDir = path.join(tickstreamRoot, '.data')

export const env = {
  root: tickstreamRoot,
  dataDir,
  databaseUrl: () => required('DATABASE_URL'),
  redisUrl: () => required('REDIS_URL'),
  sessionSecret: () => required('SESSION_SECRET'),
  apiPort: Number(optional('API_PORT') ?? '3001'),
  gatewayApiUrl: () => required('GATEWAY_API_URL'),
  storageDriver: (optional('STORAGE_DRIVER') ?? 'local') as 'local' | 'r2',
  storageDir: optional('STORAGE_DIR') ?? path.join(dataDir, 'storage'),
  tmpDir: optional('TMP_DIR') ?? path.join(dataDir, 'tmp'),
  r2: {
    accountId: optional('R2_ACCOUNT_ID'),
    accessKeyId: optional('R2_ACCESS_KEY_ID'),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY'),
    bucket: optional('R2_BUCKET'),
  },
  adminAddresses: (optional('ADMIN_ADDRESSES') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  trustProxy: optional('TRUST_PROXY') === '1',
  /** Website origins allowed to call the API from a browser, such as https://tickstream.vercel.app. Empty means none. */
  corsOrigins: (optional('CORS_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  maxUploadBytes: Number(optional('MAX_UPLOAD_BYTES') ?? String(1024 * 1024 * 1024)),
} as const
