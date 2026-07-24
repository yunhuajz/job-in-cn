import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'apps/', 'data/', 'backups/'],
  },
  ...tseslint.configs.recommended,
);
