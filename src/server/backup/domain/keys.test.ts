import { describe, expect, it } from 'vitest'
import { brasiliaStamp, dumpKey, dumpPrefix, fileKey, legacyKey, parseDumpKey } from './keys'

describe('backup keys', () => {
  it('names the dump with the date and time of Brasília', () => {
    expect(dumpKey('forms_victor', new Date('2026-10-04T06:00:00Z'))).toBe('postgres/forms_victor-2026-10-04T0300.dump')
  })

  it('keeps the Brasília day when UTC has already turned', () => {
    expect(dumpKey('forms_victor', new Date('2026-10-05T02:30:00Z'))).toBe('postgres/forms_victor-2026-10-04T2330.dump')
  })

  it('writes midnight as 00, never 24', () => {
    expect(brasiliaStamp(new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-05T0000')
  })

  it('reads the database and the moment back from the key', () => {
    expect(parseDumpKey('postgres/forms_victor-2026-10-04T0300.dump')).toEqual({
      database: 'forms_victor',
      takenAt: new Date('2026-10-04T06:00:00Z'),
    })
    expect(parseDumpKey('postgres/forms-victor-2026-10-04T2330.dump')).toEqual({
      database: 'forms-victor',
      takenAt: new Date('2026-10-05T02:30:00Z'),
    })
  })

  it('refuses keys out of format or with an impossible date', () => {
    for (const key of [
      'postgres/forms_victor-2026-10-04.dump',
      'postgres/forms_victor-2026-13-01T0300.dump',
      'postgres/forms_victor-2026-02-30T0300.dump',
      'postgres/forms_victor-2026-10-04T2400.dump',
      'postgres/forms_victor-lixo.dump',
      'postgres/-2026-10-04T0300.dump',
      'files/event_cover/a.png',
    ]) {
      expect(parseDumpKey(key)).toBeNull()
    }
  })

  it('names the prefix of one database, the copied files and the legacy files', () => {
    expect(dumpPrefix('forms_victor')).toBe('postgres/forms_victor-')
    expect(fileKey('event_cover/3f2a.png')).toBe('files/event_cover/3f2a.png')
    expect(legacyKey(new Date('2026-10-04T06:00:00Z'), 'portal.db-wal')).toBe('legacy/2026-10-04T0300/portal.db-wal')
  })
})
