import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'

export default tseslint.config(
  { ignores: ['legacy/**', 'dist/**', '.output/**', 'src/app/routeTree.gen.ts', 'src/server/shared/prisma/generated/**', 'src/components/ui/**'] },
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**', mode: 'full' },
        { type: 'entry', pattern: ['src/router.tsx', 'src/start.ts'], mode: 'full' },
        { type: 'feature-api', pattern: 'src/features/*/api/**', capture: ['feature'], mode: 'full' },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'], mode: 'full' },
        { type: 'shared-ui', pattern: ['src/components/**', 'src/lib/**', 'src/hooks/**', 'src/config/**', 'src/styles/**'], mode: 'full' },
        { type: 'shared-domain', pattern: 'src/server/shared/domain/**', mode: 'full' },
        { type: 'server-shared', pattern: 'src/server/shared/**', mode: 'full' },
        { type: 'domain', pattern: 'src/server/*/domain/**', capture: ['module'], mode: 'full' },
        { type: 'application', pattern: 'src/server/*/application/**', capture: ['module'], mode: 'full' },
        { type: 'ports', pattern: 'src/server/*/ports/**', capture: ['module'], mode: 'full' },
        { type: 'adapters', pattern: 'src/server/*/adapters/**', capture: ['module'], mode: 'full' },
        { type: 'composition', pattern: 'src/server/*/composition.ts', capture: ['module'], mode: 'full' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['app', 'feature', 'feature-api', 'shared-ui', 'domain', 'shared-domain', 'composition', 'server-shared'] },
            { from: 'entry', allow: ['app', 'shared-ui'] },
            { from: 'feature-api', allow: [['feature', { feature: '${from.feature}' }], ['feature-api', { feature: '${from.feature}' }], 'composition', 'server-shared', 'domain', 'shared-domain', 'shared-ui'] },
            { from: 'feature', allow: [['feature', { feature: '${from.feature}' }], ['feature-api', { feature: '${from.feature}' }], 'shared-ui', 'domain', 'shared-domain'] },
            { from: 'shared-ui', allow: ['shared-ui'] },
            { from: 'shared-domain', allow: ['shared-domain'] },
            { from: 'domain', allow: [['domain', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'application', allow: [['domain', { module: '${from.module}' }], ['ports', { module: '${from.module}' }], ['application', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'ports', allow: [['domain', { module: '${from.module}' }], 'shared-domain'] },
            { from: 'adapters', allow: [['ports', { module: '${from.module}' }], ['domain', { module: '${from.module}' }], ['adapters', { module: '${from.module}' }], 'server-shared', 'shared-domain'] },
            { from: 'composition', allow: [['domain', { module: '${from.module}' }], ['application', { module: '${from.module}' }], ['ports', { module: '${from.module}' }], ['adapters', { module: '${from.module}' }], 'composition', 'server-shared', 'shared-domain'] },
            { from: 'server-shared', allow: ['server-shared', 'shared-domain', 'composition'] },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage', 'indexedDB'],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB)$/]", message: 'Nada local: estado vai para o Postgres.' },
      ],
    },
  },
  {
    files: ['src/server/*/domain/**', 'src/server/shared/domain/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['node:*', '@prisma/*', '@aws-sdk/*', 'better-auth*'] }],
      'no-restricted-globals': ['error', 'process', 'fetch', 'localStorage', 'sessionStorage', 'indexedDB'],
    },
  },
)
