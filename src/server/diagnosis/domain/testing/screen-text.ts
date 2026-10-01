const MERIT_PHRASES = [
  'sai mais barato', 'sairia mais caro', 'margem aguenta', 'aguenta esse desconto',
  'mais barato do que', 'mais caro do que', 'sai mais barata', 'sairia mais barato',
]
const NEGATION = /não serve|não significa|não é|não para|nem para|é conta|não diz|nunca|deixa de|sem conta|não permite/i

export function affirmsMerit(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of MERIT_PHRASES) {
    let index = lower.indexOf(phrase)
    while (index >= 0) {
      const before = text.slice(Math.max(0, index - 90), index)
      const after = text.slice(index + phrase.length, index + phrase.length + 70)
      if (!NEGATION.test(before) && !NEGATION.test(after)) return phrase
      index = lower.indexOf(phrase, index + 1)
    }
  }
  return null
}

export function collectText(value: unknown, into: { texts: string[]; numbers: number[] } = { texts: [], numbers: [] }) {
  if (typeof value === 'string') into.texts.push(value)
  else if (typeof value === 'number') into.numbers.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, into))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectText(item, into))
  return into
}
