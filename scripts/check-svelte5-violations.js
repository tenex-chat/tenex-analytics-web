#!/usr/bin/env node

/**
 * Svelte 5 Violation Checker
 *
 * Scans .svelte files for common Svelte 4 patterns and Svelte 5 anti-patterns.
 * Useful for catching violations that ESLint might miss.
 *
 * Usage: node scripts/check-svelte5-violations.js
 * Add to package.json: "check:svelte5": "node scripts/check-svelte5-violations.js"
 */

import { readFileSync } from 'fs';
import pkg from 'glob';
const { sync: globSync } = pkg;

const violations = [];

// Patterns to detect Svelte 4 → Svelte 5 issues
const patterns = [
	{
		pattern: /\bon:(\w+)\b/g,
		message: (p1) => `Event handler syntax error: "on:${p1}" → use "on${p1}" (Svelte 5)`,
		severity: 'error'
	},
	{
		pattern: /\bonMount\b/g,
		message: () => 'Legacy lifecycle: "onMount" → use "$effect(() => { ... })" (Svelte 5)',
		severity: 'error'
	},
	{
		pattern: /\bonDestroy\b/g,
		message: () => 'Legacy lifecycle: "onDestroy" → use cleanup in "$effect": return () => { ... }',
		severity: 'error'
	},
	{
		pattern: /\bbeforeUpdate\b/g,
		message: () => 'Legacy lifecycle: "beforeUpdate" → use "$effect" (Svelte 5)',
		severity: 'error'
	},
	{
		pattern: /\bafterUpdate\b/g,
		message: () => 'Legacy lifecycle: "afterUpdate" → use "$effect" (Svelte 5)',
		severity: 'error'
	},
	{
		pattern: /export\s+let\s+/g,
		message: () => 'Legacy prop syntax: "export let" → use "$props()" (Svelte 5)',
		severity: 'warn'
	},
	{
		pattern: /\$:\s+/g,
		message: () => 'Legacy reactivity: "$: " label → use "$derived" or "$effect" (Svelte 5)',
		severity: 'warn'
	},
	{
		pattern: /let\s+\{\s*\w+[\s,\w]*\s*\}\s*=\s*\$state\(/g,
		message: () =>
			'Destructuring breaks $state reactivity. Use: let obj = $state(...); then access obj.prop',
		severity: 'error'
	},
	{
		pattern: /<slot>/g,
		message: () => 'Legacy slot syntax: "<slot>" → use "{#snippet}" (Svelte 5)',
		severity: 'warn'
	}
];

/**
 * Remove comments from content for pattern matching
 */
function removeComments(content) {
	// Remove single-line comments
	let result = content.replace(/\/\/.*$/gm, '');
	// Remove multi-line comments
	result = result.replace(/\/\*[\s\S]*?\*\//g, '');
	return result;
}

/**
 * Check a file for violations
 */
function checkFile(filePath) {
	try {
		const content = readFileSync(filePath, 'utf8');
		const contentNoComments = removeComments(content);
		const lines = content.split('\n');

		patterns.forEach(({ pattern, message, severity }) => {
			const checkContent = contentNoComments;
			let match;

			// Reset regex for multiple matches
			pattern.lastIndex = 0;

			while ((match = pattern.exec(checkContent)) !== null) {
				const lineNum = content.substring(0, match.index).split('\n').length;
				const msg = typeof message === 'function' ? message(...match.slice(1)) : message;

				violations.push({
					file: filePath,
					line: lineNum,
					severity,
					message: msg,
					preview: lines[lineNum - 1]?.trim().substring(0, 60)
				});
			}
		});
	} catch (error) {
		console.error(`❌ Error reading ${filePath}: ${error.message}`);
	}
}

// Find all .svelte files
const svelteFiles = globSync('src/**/*.svelte', {
	ignore: ['node_modules/**', '.svelte-kit/**', 'build/**']
});

if (svelteFiles.length === 0) {
	console.log('⚠️  No .svelte files found in src/');
	process.exit(0);
}

console.log(`🔍 Checking ${svelteFiles.length} .svelte file(s) for Svelte 5 violations...\n`);

// Check each file
svelteFiles.forEach(checkFile);

// Report results
if (violations.length === 0) {
	console.log('✅ No Svelte 5 violations detected!');
	process.exit(0);
}

// Group by severity
const errors = violations.filter((v) => v.severity === 'error');
const warnings = violations.filter((v) => v.severity === 'warn');

if (errors.length > 0) {
	console.log(`\n🚨 ERRORS (${errors.length}):\n`);
	errors.forEach((v) => {
		console.log(`  ${v.file}:${v.line}`);
		console.log(`    ${v.message}`);
		if (v.preview) console.log(`    Preview: ${v.preview}...`);
		console.log();
	});
}

if (warnings.length > 0) {
	console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
	warnings.forEach((v) => {
		console.log(`  ${v.file}:${v.line}`);
		console.log(`    ${v.message}`);
		if (v.preview) console.log(`    Preview: ${v.preview}...`);
		console.log();
	});
}

console.log(`\n📊 Summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log('\n📖 See https://svelte.dev/docs/svelte/v5-migration-guide for migration details.\n');

// Exit with error if there are errors
process.exit(errors.length > 0 ? 1 : 0);
