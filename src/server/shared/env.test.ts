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
    expect(env.LEGACY_DB_PATH).toBe('/legacy/portal.db')
    expect(env.BACKUP_BUCKET).toBe('forms-victor-backups')
  })

  it('rejects an S3 endpoint written as URL', () => {
    expect(() => parseEnv({ ...valid, S3_ENDPOINT: 'http://minio:9000' })).toThrow(/S3_ENDPOINT/)
  })

  it('rejects a short auth secret', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it('accepts another backup bucket and rejects a name too short', () => {
    expect(parseEnv({ ...valid, BACKUP_BUCKET: 'outro-bucket' }).BACKUP_BUCKET).toBe('outro-bucket')
    expect(() => parseEnv({ ...valid, BACKUP_BUCKET: 'ab' })).toThrow(/BACKUP_BUCKET/)
  })

  it('rejects a missing database url', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { DATABASE_URL: _omit, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })

  it('defaults SMTP to UOL Host and leaves the mailbox unset', () => {
    const env = parseEnv(valid)
    expect(env.SMTP_HOST).toBe('smtps.uhserver.com')
    expect(env.SMTP_PORT).toBe(465)
    expect(env.SMTP_USER).toBeUndefined()
  })

  it('requires SMTP user and password together', () => {
    expect(() => parseEnv({ ...valid, SMTP_USER: 'no-reply@austercontabil.com.br' })).toThrow(/SMTP_PASSWORD/)
    expect(() => parseEnv({ ...valid, SMTP_PASSWORD: 'segredo' })).toThrow(/SMTP_PASSWORD/)
    const env = parseEnv({ ...valid, SMTP_USER: 'no-reply@austercontabil.com.br', SMTP_PASSWORD: 'segredo' })
    expect(env.SMTP_USER).toBe('no-reply@austercontabil.com.br')
  })

  it('treats empty SMTP values from the compose as unset', () => {
    expect(parseEnv({ ...valid, SMTP_USER: '', SMTP_PASSWORD: '' }).SMTP_USER).toBeUndefined()
  })
})
