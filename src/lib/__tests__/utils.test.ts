import { describe, it, expect } from 'vitest';
import { formatNumber, formatCost, formatPercent, formatTokenDelta } from '$lib/utils/format.js';
import { MODEL_COLORS, CHART_PALETTE } from '$lib/utils/colors.js';

describe('formatNumber', () => {
	it('formats small numbers as-is', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(999)).toBe('999');
	});

	it('formats thousands with K suffix', () => {
		expect(formatNumber(1_000)).toBe('1.0K');
		expect(formatNumber(1_500)).toBe('1.5K');
		expect(formatNumber(999_999)).toBe('1000.0K');
	});

	it('formats millions with M suffix', () => {
		expect(formatNumber(1_000_000)).toBe('1.0M');
		expect(formatNumber(2_500_000)).toBe('2.5M');
	});
});

describe('formatCost', () => {
	it('formats zero cost', () => {
		expect(formatCost(0)).toBe('$0.0000');
	});

	it('formats small costs with 4 decimal places', () => {
		expect(formatCost(0.0012)).toBe('$0.0012');
	});

	it('formats larger costs with 2 decimal places', () => {
		expect(formatCost(1.5)).toBe('$1.50');
		expect(formatCost(10.99)).toBe('$10.99');
	});
});

describe('formatPercent', () => {
	it('formats 0 as 0.0%', () => {
		expect(formatPercent(0)).toBe('0.0%');
	});

	it('formats percentages with 1 decimal', () => {
		expect(formatPercent(42.567)).toBe('42.6%');
		expect(formatPercent(100)).toBe('100.0%');
	});
});

describe('formatTokenDelta', () => {
	it('prefixes positive deltas with +', () => {
		const result = formatTokenDelta(500);
		expect(result).toMatch(/^\+/);
	});

	it('prefixes negative deltas with -', () => {
		const result = formatTokenDelta(-200);
		expect(result).toMatch(/^-/);
	});

	it('handles zero', () => {
		const result = formatTokenDelta(0);
		expect(result).toContain('0');
	});
});

describe('MODEL_COLORS', () => {
	it('has colors for known models', () => {
		expect(MODEL_COLORS['claude-3-5-sonnet']).toBeTruthy();
		expect(MODEL_COLORS['gpt-4o']).toBeTruthy();
	});
});

describe('CHART_PALETTE', () => {
	it('is a non-empty array of hex color strings', () => {
		expect(Array.isArray(CHART_PALETTE)).toBe(true);
		expect(CHART_PALETTE.length).toBeGreaterThan(0);
		for (const color of CHART_PALETTE) {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});
});
