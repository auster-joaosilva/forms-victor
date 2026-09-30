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
        { type: 'app', pattern: 'src/app/**', partialMatch: false },
        { type: 'entry', pattern: ['src/router.tsx', 'src/start.ts'], partialMatch: false },
        { type: 'feature-api', pattern: 'src/features/*/api/**', capture: ['feature'], partialMatch: false },
        { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'], partialMatch: false },
        { type: 'shared-ui', pattern: ['src/components/**', 'src/lib/**', 'src/hooks/**', 'src/config/**', 'src/styles/**'], partialMatch: false },
        { type: 'shared-domain', pattern: 'src/server/shared/domain/**', partialMatch: false },
        { type: 'server-shared', pattern: 'src/server/shared/**', partialMatch: false },
        { type: 'domain', pattern: 'src/server/*/domain/**', capture: ['module'], partialMatch: false },
        { type: 'application', pattern: 'src/server/*/application/**', capture: ['module'], partialMatch: false },
        { type: 'ports', pattern: 'src/server/*/ports/**', capture: ['module'], partialMatch: false },
        { type: 'adapters', pattern: 'src/server/*/adapters/**', capture: ['module'], partialMatch: false },
        { type: 'composition', pattern: 'src/server/*/composition.ts', capture: ['module'], partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: [
                { to: { element: { type: 'app' } } },
                { to: { element: { type: 'feature' } } },
                { to: { element: { type: 'feature-api' } } },
                { to: { element: { type: 'shared-ui' } } },
                { to: { element: { type: 'domain' } } },
                { to: { element: { type: 'shared-domain' } } },
                { to: { element: { type: 'composition' } }, partialMatch: false },
                { to: { element: { type: 'server-shared' } } }
              ],
            },
            {
              from: { element: { type: 'entry' } },
              allow: [
                { to: { element: { type: 'app' } } },
                { to: { element: { type: 'shared-ui' } } }
              ],
            },
            {
              from: { element: { type: 'feature-api' } },
              allow: [
                { to: { element: { type: 'feature', captured: { feature: '{{ from.element.captured.feature }}' } } } },
                { to: { element: { type: 'feature-api', captured: { feature: '{{ from.element.captured.feature }}' } } } },
                { to: { element: { type: 'composition' } }, partialMatch: false },
                { to: { element: { type: 'server-shared' } } },
                { to: { element: { type: 'domain' } } },
                { to: { element: { type: 'shared-domain' } } },
                { to: { element: { type: 'shared-ui' } } }
              ],
            },
            {
              from: { element: { type: 'feature' } },
              allow: [
                { to: { element: { type: 'feature', captured: { feature: '{{ from.element.captured.feature }}' } } } },
                { to: { element: { type: 'feature-api', captured: { feature: '{{ from.element.captured.feature }}' } } } },
                { to: { element: { type: 'shared-ui' } } },
                { to: { element: { type: 'domain' } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'shared-ui' } },
              allow: [
                { to: { element: { type: 'shared-ui' } } }
              ],
            },
            {
              from: { element: { type: 'shared-domain' } },
              allow: [
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'domain' } },
              allow: [
                { to: { element: { type: 'domain', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'application' } },
              allow: [
                { to: { element: { type: 'domain', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'ports', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'application', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'ports' } },
              allow: [
                { to: { element: { type: 'domain', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'adapters' } },
              allow: [
                { to: { element: { type: 'ports', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'domain', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'adapters', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'server-shared' } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'composition' }, partialMatch: false },
              allow: [
                { to: { element: { type: 'domain', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'application', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'ports', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'adapters', captured: { module: '{{ from.element.captured.module }}' } } } },
                { to: { element: { type: 'composition' } }, partialMatch: false },
                { to: { element: { type: 'server-shared' } } },
                { to: { element: { type: 'shared-domain' } } }
              ],
            },
            {
              from: { element: { type: 'server-shared' } },
              allow: [
                { to: { element: { type: 'server-shared' } } },
                { to: { element: { type: 'shared-domain' } } },
                { to: { element: { type: 'composition' } } }
              ],
            },
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
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
