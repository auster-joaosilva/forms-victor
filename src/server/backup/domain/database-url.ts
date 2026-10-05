export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
}

// Sem porta, o libpq usa a 5432. Uma URL que não se lê conta como o banco do app: na dúvida, a restauração recusa.
export function isSameDatabase(a: string, b: string): boolean {
  try {
    const left = new URL(a)
    const right = new URL(b)
    return (
      left.hostname.toLowerCase() === right.hostname.toLowerCase() &&
      (left.port || '5432') === (right.port || '5432') &&
      databaseNameOf(a) === databaseNameOf(b)
    )
  } catch {
    return true
  }
}
