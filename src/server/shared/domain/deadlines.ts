// Resolução CGSN 194/2026 (DOU extra de 28/09/2026), que deu nova redação aos prazos da Resolução CGSN 186/2026:
// a opção pelo regime regular vai a 30/10; a entrada no Simples, a 15/10; o cancelamento deixou de ser "até 30/11"
// e virou janela com começo, de 03/11 a 20/12, irretratável. Antes de 03/11 o cancelamento não existe.
export const DEADLINES = {
  windowEnd: '2026-10-30',
  simplesEntryUntil: '2026-10-15',
  withdrawalFrom: '2026-11-03',
  withdrawalUntil: '2026-12-20',
  effectSemester: '1º semestre de 2027',
  nextWindow: 'março de 2027',
  nextWindowEffect: '2º semestre de 2027',
  // Operational lead time asked by the firm, in business days. Not a legal deadline.
  filingSlackDays: 3,
} as const
