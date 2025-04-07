import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'test/**', 'examples/**'],
        files: ['src/**/*.ts'],
        rules: {
            // Your custom rules
            'no-console': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_'
            }],
            '@typescript-eslint/no-empty-function': 'warn',
        },
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                ecmaVersion: 2022,
                sourceType: 'module',
            },
        },
    },
);