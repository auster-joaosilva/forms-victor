import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })

const isSource = (path: string) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)

const backofficeApiFiles = readdirSync('src/features')
  .filter((feature) => feature.startsWith('backoffice-'))
  .flatMap((feature) => filesUnder(join('src/features', feature, 'api')))
  .filter(isSource)

const backofficeRouteFiles = filesUnder('src/app/routes/backoffice').filter(isSource)

// Cada `export const X = createServerFn(...)...` vai até o próximo `export` de topo ou o fim do arquivo.
function serverFunctions(source: string): { name: string; chain: string }[] {
  const pattern = /export const (\w+) = createServerFn\(/g
  const starts = [...source.matchAll(pattern)]
  return starts.map((match, index) => {
    const end = source.indexOf('\nexport ', (match.index ?? 0) + 1)
    const next = starts[index + 1]?.index
    const stop = Math.min(end === -1 ? source.length : end, next ?? source.length)
    return { name: match[1] ?? '?', chain: source.slice(match.index, stop) }
  })
}

describe('every backoffice entry point declares a capability', () => {
  it('finds the backoffice server functions', () => {
    expect(backofficeApiFiles.length).toBeGreaterThanOrEqual(4)
    expect(backofficeApiFiles.flatMap((file) => serverFunctions(readFileSync(file, 'utf8'))).length).toBeGreaterThanOrEqual(12)
  })

  it('guards each server function with requireCapability', () => {
    const missing = backofficeApiFiles.flatMap((file) =>
      serverFunctions(readFileSync(file, 'utf8'))
        .filter(({ chain }) => !/\.middleware\(\[requireCapability\('\w+'\)\]\)/.test(chain))
        .map(({ name }) => `${file}: ${name}`),
    )
    expect(missing).toEqual([])
  })

  it('never uses a bare session middleware in the backoffice', () => {
    const bare = [...backofficeApiFiles, ...backofficeRouteFiles].filter((file) => /sessionMiddleware|adminMiddleware|getSessionUser\(/.test(readFileSync(file, 'utf8')))
    expect(bare).toEqual([])
  })

  it('checks the capability in each server route handler', () => {
    const missing = backofficeRouteFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /handlers:\s*\{/.test(source) && !/ensureCapability\(request, '\w+'\)/.test(source)
    })
    expect(missing).toEqual([])
  })
})
