const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// Dia civil, não instante: new Date('2026-10-20') cai em UTC e, no Brasil, volta um dia.
export function longDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const name = MONTHS[(month ?? 0) - 1]
  if (!year || !day || !name) return ''
  return `${day} de ${name}`
}
