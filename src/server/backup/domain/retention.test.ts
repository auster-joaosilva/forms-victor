import { describe, expect, it } from 'vitest'
import { dumpKey } from './keys'
import { dumpsToDelete, type DumpEntry } from './retention'

const DAY = 86_400_000
const at = (iso: string): DumpEntry => ({
  key: dumpKey('forms_victor', new Date(iso)),
  takenAt: new Date(iso),
})

// Um dump por dia às 03:00 de Brasília, do mais velho ao mais novo.
function daily(fromIso: string, toIso: string): DumpEntry[] {
  const dumps: DumpEntry[] = []
  for (let time = Date.parse(fromIso); time <= Date.parse(toIso); time += DAY)
    dumps.push(at(new Date(time).toISOString()))
  return dumps
}

const keyOf = (isoDay: string) => dumpKey('forms_victor', new Date(`${isoDay}T06:00:00Z`))

describe('dumpsToDelete', () => {
  const sundayMorning = new Date('2026-10-04T06:05:00Z')

  it('deletes nothing from an empty list or from up to seven dumps', () => {
    expect(dumpsToDelete([], sundayMorning)).toEqual([])
    expect(dumpsToDelete(daily('2026-09-29T06:00:00Z', '2026-10-04T06:00:00Z'), sundayMorning)).toEqual([])
    expect(dumpsToDelete(daily('2026-09-28T06:00:00Z', '2026-10-04T06:00:00Z'), sundayMorning)).toEqual([])
  })

  it('keeps the seven newest and the Sundays of the last four weeks', () => {
    const dumps = daily('2026-08-26T06:00:00Z', '2026-10-04T06:00:00Z')
    expect(dumps).toHaveLength(40)
    const deleted = dumpsToDelete(dumps, sundayMorning)
    const kept = dumps.map((dump) => dump.key).filter((key) => !deleted.includes(key))
    expect(kept.sort()).toEqual(
      [
        '2026-09-13',
        '2026-09-20',
        '2026-09-27',
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
      ]
        .map(keyOf)
        .sort(),
    )
    expect(deleted).toHaveLength(30)
    expect(deleted).toContain(keyOf('2026-09-06'))
    expect(deleted[0]).toBe(keyOf('2026-09-26'))
  })

  it('counts the four weeks back from the Brasília day of now', () => {
    const saturday = new Date('2026-10-10T06:05:00Z')
    const dumps = daily('2026-08-26T06:00:00Z', '2026-10-10T06:00:00Z')
    const deleted = dumpsToDelete(dumps, saturday)
    expect(deleted).not.toContain(keyOf('2026-09-13'))
    expect(deleted).toContain(keyOf('2026-09-06'))
    expect(dumps.length - deleted.length).toBe(10)
  })

  it('decides Sunday by the Brasília date and keeps only the newest dump of that Sunday', () => {
    const sundayEarly = at('2026-09-27T06:00:00Z')
    const sundayLate = at('2026-09-28T02:30:00Z')
    const saturdayLateUtcSunday = at('2026-09-20T02:00:00Z')
    const olderSunday = at('2026-09-13T06:00:00Z')
    const dumps = [
      ...daily('2026-09-28T06:00:00Z', '2026-10-04T06:00:00Z'),
      sundayEarly,
      sundayLate,
      saturdayLateUtcSunday,
      olderSunday,
    ]
    expect(dumpsToDelete(dumps, sundayMorning)).toEqual([sundayEarly.key, saturdayLateUtcSunday.key])
  })

  it('keeps only the newest dump of each day', () => {
    const older = at('2026-10-03T05:00:00Z')
    const newer = at('2026-10-03T06:00:00Z')
    const dumps = [...daily('2026-09-28T06:00:00Z', '2026-10-02T06:00:00Z'), older, newer, at('2026-10-04T06:00:00Z')]
    expect(dumpsToDelete(dumps, sundayMorning)).toEqual([older.key])
  })

  it('counts the seven days with dumps, not the seven newest runs', () => {
    const extra = [at('2026-10-04T05:00:00Z'), at('2026-10-03T05:00:00Z'), at('2026-10-02T05:00:00Z')]
    const dumps = [...daily('2026-09-28T06:00:00Z', '2026-10-04T06:00:00Z'), ...extra]
    expect(dumpsToDelete(dumps, sundayMorning).sort()).toEqual(extra.map((dump) => dump.key).sort())
    const eighthDay = [...daily('2026-09-27T06:00:00Z', '2026-10-04T06:00:00Z'), at('2026-09-26T06:00:00Z')]
    expect(dumpsToDelete(eighthDay, sundayMorning)).toEqual([keyOf('2026-09-26')])
  })

  it('never deletes an entry whose date could not be read', () => {
    const broken = { key: 'postgres/forms_victor-lixo.dump', takenAt: new Date('x') }
    const deleted = dumpsToDelete([...daily('2026-08-26T06:00:00Z', '2026-10-04T06:00:00Z'), broken], sundayMorning)
    expect(deleted).not.toContain(broken.key)
    expect(deleted).toHaveLength(30)
  })
})
