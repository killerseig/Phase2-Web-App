import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'
import vuePlugin from 'eslint-plugin-vue'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  {
    ignores: ['dist/**', 'functions/**', 'public/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'vue/no-mutating-props': 'error',
      'vue/require-v-for-key': 'error',
      'vue/valid-v-model': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]