export function remainingSeats(seats: number | null, taken: number): number | null {
  return seats === null ? null : Math.max(0, seats - taken)
}

export function sessionBadge(remaining: number | null): string | null {
  if (remaining === null) return null
  if (remaining === 0) return 'Sem vagas'
  if (remaining === 1) return 'Última vaga'
  if (remaining <= 5) return `Últimas ${remaining} vagas`
  return `${remaining} vagas`
}
