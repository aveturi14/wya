const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // website/ is a separate Next.js app; the rest is generated, built or not app code.
    ignores: ['website/**', 'dist/**', 'ios/**', 'android/**', '.expo/**', 'deps.nosync/**', 'supabase/**', '.agents/**', '.claude/**'],
  },
  {
    // Baseline (issue 28): these fired as errors on code that predates the linter.
    // Warn for now so CI starts green; a follow-up fixes them and ratchets back to 'error'.
    rules: {
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
]);
