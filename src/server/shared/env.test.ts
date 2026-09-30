import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  DATABASE_URL: 'postgresql://app:app@localhost:5432/forms_victor_dev',
  S3_ENDPOINT: 'localhost:9000',
  S3_BUCKET: 'forms-victor-dev',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  APP_PUBLIC_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    const env = parseEnv(valid)
    expect(env.PORT).toBe(3000)
    expect(env.S3_USE_SSL).toBe(false)
    expect(env.ADHESION_WINDOW_END).toBe('2026-09-30')
  })

  it('rejects an S3 endpoint written as URL', () => {
    expect(() => parseEnv({ ...valid, S3_ENDPOINT: 'http://minio:9000' })).toThrow(/S3_ENDPOINT/)
  })

  it('rejects a short auth secret', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('rejects a missing database url', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { DATABASE_URL: _omit, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })
})
