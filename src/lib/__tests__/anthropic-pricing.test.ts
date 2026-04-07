import { describe, expect, it } from 'vitest';
import {
	allocatePromptCostByTokens,
	inferAnthropicRequestCost,
	normalizeAnthropicModel
} from '$lib/server/anthropic-pricing.js';
import { formatCost } from '$lib/utils/format.js';

describe('normalizeAnthropicModel', () => {
	it('normalizes canonical and dated Anthropic model ids', () => {
		expect(normalizeAnthropicModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
		expect(normalizeAnthropicModel('claude-3-7-sonnet-20250219')).toBe('claude-sonnet-3-7');
		expect(normalizeAnthropicModel('anthropic/claude-haiku-4-5')).toBe('claude-haiku-4-5');
	});
});

describe('inferAnthropicRequestCost', () => {
	it('infers request cost using input, cache, and output buckets', () => {
		const cost = inferAnthropicRequestCost({
			provider: 'anthropic.messages',
			model: 'claude-sonnet-4-6',
			inputTokens: 10_000,
			outputTokens: 500,
			cacheReadTokens: 8_000,
			cacheWriteTokens: 2_000
		});

		expect(cost).not.toBeNull();
		expect(cost?.inputCostUsd).toBeCloseTo(0.03, 6);
		expect(cost?.cacheReadCostUsd).toBeCloseTo(0.0024, 6);
		expect(cost?.cacheWriteCostUsd).toBeCloseTo(0.0075, 6);
		expect(cost?.outputCostUsd).toBeCloseTo(0.0075, 6);
		expect(cost?.promptCostUsd).toBeCloseTo(0.0399, 6);
		expect(cost?.totalCostUsd).toBeCloseTo(0.0474, 6);
		expect(cost?.cacheWriteTtl).toBe('5m');
	});

	it('returns null for non-Anthropic providers or unknown models', () => {
		expect(
			inferAnthropicRequestCost({
				provider: 'openai.responses',
				model: 'gpt-5.4',
				inputTokens: 1,
				outputTokens: 1,
				cacheReadTokens: 0,
				cacheWriteTokens: 0
			})
		).toBeNull();

		expect(
			inferAnthropicRequestCost({
				provider: 'anthropic.messages',
				model: 'claude-unknown-9',
				inputTokens: 1,
				outputTokens: 1,
				cacheReadTokens: 0,
				cacheWriteTokens: 0
			})
		).toBeNull();
	});
});

describe('allocatePromptCostByTokens', () => {
	it('allocates prompt cost proportionally by message token counts', () => {
		const allocations = allocatePromptCostByTokens([100, 300, 600], 0.1);
		expect(allocations[0]).toBeCloseTo(0.01, 6);
		expect(allocations[1]).toBeCloseTo(0.03, 6);
		expect(allocations[2]).toBeCloseTo(0.06, 6);
	});
});

describe('formatCost', () => {
	it('can show sub-cent values when higher precision is requested', () => {
		expect(formatCost(0.0005, 4)).toBe('$0.0005');
	});
});
