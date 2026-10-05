import { describe, expect, it } from 'vitest'
import { databaseNameOf, isSameDatabase } from './database-url'

const APP = 'postgresql://app:secret@postgres:5432/forms_victor'

describe('databaseNameOf', () => {
  it('reads the database name without the query string', () => {
    expect(databaseNameOf('postgresql://app:a@postgres:5432/forms_victor?schema=public')).toBe('forms_victor')
  })
})

describe('isSameDatabase', () => {
  it('compares only host, port and database name', () => {
    expect(isSameDatabase(APP, 'postgresql://other:b@postgres:5432/forms_victor?sslmode=disable')).toBe(true)
  })

  it('treats a missing port as 5432 and ignores the case of the host', () => {
    expect(isSameDatabase(APP, 'postgresql://app:secret@POSTGRES/forms_victor')).toBe(true)
  })

  it('tells apart another database, host or port', () => {
    expect(isSameDatabase(APP, 'postgresql://app:secret@postgres:5432/forms_victor_restore')).toBe(false)
    expect(isSameDatabase(APP, 'postgresql://app:secret@outro:5432/forms_victor')).toBe(false)
    expect(isSameDatabase(APP, 'postgresql://app:secret@postgres:5433/forms_victor')).toBe(false)
  })

  it('counts an unreadable url as the same database', () => {
    expect(isSameDatabase('lixo', APP)).toBe(true)
  })
})
