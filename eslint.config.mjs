import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Config flat de ESLint (v9+). Objetivo: parseo real de TS/TSX y detección de
 * errores auténticos (variables sin declarar, imports rotos), sin imponer ruido
 * estilístico que bloquee el gate de calidad. Sin type-checking (sin `project`)
 * para que corra rápido en el hook por-fichero.
 */
export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      // Worktrees locales de sesiones paralelas: están en .gitignore y traen su
      // propio `.next/` compilado. Sin esto, `npm run lint` intenta analizar miles
      // de ficheros de build ajenos y falla por ruido en cualquier máquina que los
      // tenga — en CI, que clona limpio, no existían y por eso pasaba desapercibido.
      '.claude/**',
      'drizzle/**',
      'next-env.d.ts',
      'design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
