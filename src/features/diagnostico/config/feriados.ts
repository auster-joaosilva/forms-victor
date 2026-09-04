/**
 * Feriados nacionais, em data local de Sao Paulo (AAAA-MM-DD).
 *
 * Entram no calculo de hora util: prazo de 4 h uteis que cai em feriado nao e
 * prazo de 4 h. A lista e finita de proposito — quando 2027 acabar, alguem
 * tem de acrescentar 2028, e um teste que falha e melhor que um SLA errado
 * calculado em silencio. Ver `utils/prazo.ts`.
 */
export const FERIADOS: ReadonlyArray<string> = [
  // 2025
  '2025-01-01',
  '2025-03-03',
  '2025-03-04',
  '2025-04-18',
  '2025-04-21',
  '2025-05-01',
  '2025-06-19',
  '2025-09-07',
  '2025-10-12',
  '2025-11-02',
  '2025-11-15',
  '2025-11-20',
  '2025-12-25',
  // 2026
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-06-04',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-25',
  // 2027
  '2027-01-01',
  '2027-02-08',
  '2027-02-09',
  '2027-03-26',
  '2027-04-21',
  '2027-05-01',
  '2027-05-27',
  '2027-09-07',
  '2027-10-12',
  '2027-11-02',
  '2027-11-15',
  '2027-11-20',
  '2027-12-25',
]

/** Ate onde a lista cobre. Depois disso o calculo de prazo nao e confiavel. */
export const ULTIMO_ANO_COBERTO = 2027
