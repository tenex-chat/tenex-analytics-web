// Enhanced ESLint config for Svelte 5 compliance
// Use this to replace/upgrade your .eslintrc.cjs

module.exports = {
	root: true,
	ignorePatterns: ['build/', '.svelte-kit/', 'node_modules/'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:svelte/recommended'
	],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020,
		extraFileExtensions: ['.svelte']
	},
	env: {
		browser: true,
		es2017: true,
		node: true
	},
	overrides: [
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser'
			},
			globals: {
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly'
			}
		}
	],
	rules: {
		// ========================================
		// Svelte 5 Runes & Syntax Enforcement
		// ========================================

		// Prevent old Svelte 4 lifecycle methods
		'no-restricted-syntax': [
			'error',
			{
				selector: "CallExpression[callee.name='onMount']",
				message: "onMount is Svelte 4. Use $effect() instead: $effect(() => { /* setup */ })"
			},
			{
				selector: "CallExpression[callee.name='onDestroy']",
				message:
					"onDestroy is Svelte 4. Use $effect cleanup: $effect(() => { return () => { /* cleanup */ } })"
			},
			{
				selector: "CallExpression[callee.name='beforeUpdate']",
				message:
					'beforeUpdate is Svelte 4. Use $effect() for reactive updates instead'
			},
			{
				selector: "CallExpression[callee.name='afterUpdate']",
				message:
					'afterUpdate is Svelte 4. Use $effect() with proper dependency tracking instead'
			}
		],

		// ========================================
		// TypeScript & Type Safety
		// ========================================

		'@typescript-eslint/no-explicit-any': 'error', // Enforce proper typing
		'@typescript-eslint/explicit-function-return-type': [
			'warn',
			{
				allowExpressions: true,
				allowTypedFunctionExpressions: true,
				allowHigherOrderFunctions: true
			}
		],
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				destructuredArrayIgnorePattern: '^_',
				varsIgnorePattern: '^_'
			}
		],
		'@typescript-eslint/no-non-null-assertion': 'warn',
		'@typescript-eslint/no-inferrable-types': 'warn',

		// ========================================
		// Code Quality
		// ========================================

		'prefer-const': 'error',
		'no-var': 'error',
		'no-console': [
			'warn',
			{
				allow: ['warn', 'error']
			}
		],
		'no-debugger': 'warn',
		'no-alert': 'warn',

		// ========================================
		// Svelte-Specific Rules
		// ========================================

		'svelte/no-at-html-tags': 'error', // Prevent {@html} misuse (security risk)
		'svelte/no-store-async': 'warn', // Prevent async in stores
		'svelte/valid-compile': 'error', // Catch Svelte compiler errors
		'svelte/no-unused-svelte-ignore': 'warn',
		'svelte/prefer-style-directive': 'warn'
	}
};
