module.exports = {
  ignores: ['dist/**', 'node_modules/**', '**/*.icns', '**/*.png'],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    globals: {
      window: 'readonly',
      document: 'readonly',
      localStorage: 'readonly'
    }
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    eqeqeq: 'error'
  }
};
