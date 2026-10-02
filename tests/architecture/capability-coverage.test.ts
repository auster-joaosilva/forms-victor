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
const scannedFiles = [...backofficeApiFiles, ...backofficeRouteFiles]

const HANDLER_METHODS = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g
const handlerBlock = (source: string) => {
  const start = source.search(/handlers:\s*\{/)
  return start === -1 ? null : source.slice(start)
}
const routeHandlerFiles = backofficeRouteFiles.filter((file) => handlerBlock(readFileSync(file, 'utf8')) !== null)

// Cada `const X = createServerFn(...)...`, exportada ou não, vai até a próxima declaração de topo ou o fim do arquivo.
function serverFunctions(source: string): { name: string; chain: string }[] {
  const pattern = /(?:export )?const (\w+) = createServerFn\(/g
  const starts = [...source.matchAll(pattern)]
  return starts.map((match, index) => {
    const end = source.slice((match.index ?? 0) + 1).search(/\n(?:export |const |function |async function )/)
    const next = starts[index + 1]?.index
    const stop = Math.min(end === -1 ? source.length : (match.index ?? 0) + 1 + end, next ?? source.length)
    return { name: match[1] ?? '?', chain: source.slice(match.index, stop) }
  })
}

describe('every backoffice entry point declares a capability', () => {
  it('finds the backoffice server functions', () => {
    expect(backofficeApiFiles.length).toBeGreaterThanOrEqual(4)
    expect(scannedFiles.flatMap((file) => serverFunctions(readFileSync(file, 'utf8'))).length).toBeGreaterThanOrEqual(12)
  })

  it('finds the backoffice route handlers', () => {
    expect(routeHandlerFiles.length).toBeGreaterThanOrEqual(1)
  })

  it('guards each server function with requireCapability', () => {
    const missing = scannedFiles.flatMap((file) =>
      serverFunctions(readFileSync(file, 'utf8'))
        .filter(({ chain }) => !/\.middleware\(\[requireCapability\('\w+'\)\]\)/.test(chain))
        .map(({ name }) => `${file}: ${name}`),
    )
    expect(missing).toEqual([])
  })

  it('never uses a bare session middleware in the backoffice', () => {
    const bare = scannedFiles.filter((file) => /sessionMiddleware|adminMiddleware|getSessionUser\(/.test(readFileSync(file, 'utf8')))
    expect(bare).toEqual([])
  })

  it('checks the capability in each server route handler method', () => {
    const missing = routeHandlerFiles.flatMap((file) => {
      const block = handlerBlock(readFileSync(file, 'utf8')) ?? ''
      const methods = [...block.matchAll(HANDLER_METHODS)]
      if (methods.length === 0) return [`${file}: no handler method found`]
      return methods
        .filter((method, index) => !/ensureCapability\(request, '\w+'\)/.test(block.slice(method.index, methods[index + 1]?.index ?? block.length)))
        .map((method) => `${file}: ${method[1]}`)
    })
    expect(missing).toEqual([])
  })
})
