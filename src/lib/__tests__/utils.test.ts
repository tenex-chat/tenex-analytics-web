import { describe, it, expect } from 'vitest';
import { formatNumber, formatCost, formatPercent, formatTokenDelta } from '$lib/utils/format.js';
import { SERIES_COLORS } from '$lib/utils/colors.js';

describe('formatNumber', () => {
	it('formats small numbers as-is', () => {
		expect(formatNumber(0)).toBe('0');
		expect(formatNumber(999)).toBe('999');
	});

	it('formats thousands with locale separators', () => {
		expect(formatNumber(1_000)).toBe('1,000');
		expect(formatNumber(1_500)).toBe('1,500');
		expect(formatNumber(999_999)).toBe('999,999');
	});

	it('formats millions with locale separators', () => {
		expect(formatNumber(1_000_000)).toBe('1,000,000');
		expect(formatNumber(2_500_000)).toBe('2,500,000');
	});
});

describe('formatCost', () => {
	it('formats zero cost', () => {
		expect(formatCost(0)).toBe('$0.00');
	});

	it('shows very small non-zero costs as less than one cent', () => {
		expect(formatCost(0.0012)).toBe('<$0.01');
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

describe('SERIES_COLORS', () => {
	it('is a non-empty array of hex color strings', () => {
		expect(Array.isArray(SERIES_COLORS)).toBe(true);
		expect(SERIES_COLORS.length).toBeGreaterThan(0);
		for (const color of SERIES_COLORS) {
			expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
		}
	});
});
