export interface AnthropicModelPricing {
	inputUsdPerMTok: number;
	cacheWrite5mUsdPerMTok: number;
	cacheWrite1hUsdPerMTok: number;
	cacheReadUsdPerMTok: number;
	outputUsdPerMTok: number;
}

export interface AnthropicRequestUsage {
	provider?: string | null;
	model: string;
	inputTokens: number;
	inputNoCacheTokens?: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
}

export interface AnthropicInferredCost {
	model: string;
	canonicalModel: string;
	cacheWriteTtl: '5m';
	inputCostUsd: number;
	cacheReadCostUsd: number;
	cacheWriteCostUsd: number;
	promptCostUsd: number;
	outputCostUsd: number;
	totalCostUsd: number;
}

const TOKENS_PER_MTOK = 1_000_000;

// Sources:
// - https://platform.claude.com/docs/en/about-claude/pricing
// - https://claude.com/pricing
export const ANTHROPIC_MODEL_PRICING: Record<string, AnthropicModelPricing> = {
	'claude-opus-4-6': {
		inputUsdPerMTok: 5,
		cacheWrite5mUsdPerMTok: 6.25,
		cacheWrite1hUsdPerMTok: 10,
		cacheReadUsdPerMTok: 0.5,
		outputUsdPerMTok: 25
	},
	'claude-opus-4-5': {
		inputUsdPerMTok: 5,
		cacheWrite5mUsdPerMTok: 6.25,
		cacheWrite1hUsdPerMTok: 10,
		cacheReadUsdPerMTok: 0.5,
		outputUsdPerMTok: 25
	},
	'claude-opus-4-1': {
		inputUsdPerMTok: 15,
		cacheWrite5mUsdPerMTok: 18.75,
		cacheWrite1hUsdPerMTok: 30,
		cacheReadUsdPerMTok: 1.5,
		outputUsdPerMTok: 75
	},
	'claude-opus-4': {
		inputUsdPerMTok: 15,
		cacheWrite5mUsdPerMTok: 18.75,
		cacheWrite1hUsdPerMTok: 30,
		cacheReadUsdPerMTok: 1.5,
		outputUsdPerMTok: 75
	},
	'claude-sonnet-4-6': {
		inputUsdPerMTok: 3,
		cacheWrite5mUsdPerMTok: 3.75,
		cacheWrite1hUsdPerMTok: 6,
		cacheReadUsdPerMTok: 0.3,
		outputUsdPerMTok: 15
	},
	'claude-sonnet-4-5': {
		inputUsdPerMTok: 3,
		cacheWrite5mUsdPerMTok: 3.75,
		cacheWrite1hUsdPerMTok: 6,
		cacheReadUsdPerMTok: 0.3,
		outputUsdPerMTok: 15
	},
	'claude-sonnet-4': {
		inputUsdPerMTok: 3,
		cacheWrite5mUsdPerMTok: 3.75,
		cacheWrite1hUsdPerMTok: 6,
		cacheReadUsdPerMTok: 0.3,
		outputUsdPerMTok: 15
	},
	'claude-sonnet-3-7': {
		inputUsdPerMTok: 3,
		cacheWrite5mUsdPerMTok: 3.75,
		cacheWrite1hUsdPerMTok: 6,
		cacheReadUsdPerMTok: 0.3,
		outputUsdPerMTok: 15
	},
	'claude-haiku-4-5': {
		inputUsdPerMTok: 1,
		cacheWrite5mUsdPerMTok: 1.25,
		cacheWrite1hUsdPerMTok: 2,
		cacheReadUsdPerMTok: 0.1,
		outputUsdPerMTok: 5
	},
	'claude-haiku-3-5': {
		inputUsdPerMTok: 0.8,
		cacheWrite5mUsdPerMTok: 1,
		cacheWrite1hUsdPerMTok: 1.6,
		cacheReadUsdPerMTok: 0.08,
		outputUsdPerMTok: 4
	},
	'claude-opus-3': {
		inputUsdPerMTok: 15,
		cacheWrite5mUsdPerMTok: 18.75,
		cacheWrite1hUsdPerMTok: 30,
		cacheReadUsdPerMTok: 1.5,
		outputUsdPerMTok: 75
	},
	'claude-haiku-3': {
		inputUsdPerMTok: 0.25,
		cacheWrite5mUsdPerMTok: 0.3,
		cacheWrite1hUsdPerMTok: 0.5,
		cacheReadUsdPerMTok: 0.03,
		outputUsdPerMTok: 1.25
	}
};

function usdFromTokens(tokens: number, usdPerMTok: number): number {
	return (Math.max(0, tokens) * usdPerMTok) / TOKENS_PER_MTOK;
}

export function isAnthropicProvider(provider?: string | null): boolean {
	return (provider ?? '').toLowerCase().startsWith('anthropic');
}

export function normalizeAnthropicModel(model: string): string | null {
	if (!model) return null;

	let normalized = model.trim().toLowerCase();
	normalized = normalized.replace(/^.*\//, '');
	normalized = normalized.replace(/[:@].*$/, '');
	normalized = normalized.replace(/[_.\s]+/g, '-');
	normalized = normalized.replace(/-latest$/, '');

	if (normalized in ANTHROPIC_MODEL_PRICING) {
		return normalized;
	}

	const aliases: Array<[RegExp, string]> = [
		[/claude-opus-4-6(?:-\d{8})?$/, 'claude-opus-4-6'],
		[/claude-opus-4-5(?:-\d{8})?$/, 'claude-opus-4-5'],
		[/claude-opus-4-1(?:-\d{8})?$/, 'claude-opus-4-1'],
		[/claude-opus-4(?:-\d{8})?$/, 'claude-opus-4'],
		[/claude-sonnet-4-6(?:-\d{8})?$/, 'claude-sonnet-4-6'],
		[/claude-sonnet-4-5(?:-\d{8})?$/, 'claude-sonnet-4-5'],
		[/claude-sonnet-4(?:-\d{8})?$/, 'claude-sonnet-4'],
		[/claude-3-7-sonnet(?:-\d{8})?$/, 'claude-sonnet-3-7'],
		[/claude-sonnet-3-7(?:-\d{8})?$/, 'claude-sonnet-3-7'],
		[/claude-haiku-4-5(?:-\d{8})?$/, 'claude-haiku-4-5'],
		[/claude-3-5-haiku(?:-\d{8})?$/, 'claude-haiku-3-5'],
		[/claude-haiku-3-5(?:-\d{8})?$/, 'claude-haiku-3-5'],
		[/claude-3-opus(?:-\d{8})?$/, 'claude-opus-3'],
		[/claude-opus-3(?:-\d{8})?$/, 'claude-opus-3'],
		[/claude-3-haiku(?:-\d{8})?$/, 'claude-haiku-3'],
		[/claude-haiku-3(?:-\d{8})?$/, 'claude-haiku-3']
	];

	for (const [pattern, canonical] of aliases) {
		if (pattern.test(normalized)) {
			return canonical;
		}
	}

	return null;
}

export function inferAnthropicRequestCost(
	usage: AnthropicRequestUsage
): AnthropicInferredCost | null {
	if (!isAnthropicProvider(usage.provider)) {
		return null;
	}

	const canonicalModel = normalizeAnthropicModel(usage.model);
	if (!canonicalModel) {
		return null;
	}

	const pricing = ANTHROPIC_MODEL_PRICING[canonicalModel];
	const inputTokens =
		usage.inputNoCacheTokens ??
		Math.max(0, usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens);
	const inputCostUsd = usdFromTokens(inputTokens, pricing.inputUsdPerMTok);
	const cacheReadCostUsd = usdFromTokens(usage.cacheReadTokens, pricing.cacheReadUsdPerMTok);
	const cacheWriteCostUsd = usdFromTokens(usage.cacheWriteTokens, pricing.cacheWrite5mUsdPerMTok);
	const outputCostUsd = usdFromTokens(usage.outputTokens, pricing.outputUsdPerMTok);
	const promptCostUsd = inputCostUsd + cacheReadCostUsd + cacheWriteCostUsd;

	return {
		model: usage.model,
		canonicalModel,
		cacheWriteTtl: '5m',
		inputCostUsd,
		cacheReadCostUsd,
		cacheWriteCostUsd,
		promptCostUsd,
		outputCostUsd,
		totalCostUsd: promptCostUsd + outputCostUsd
	};
}

export function buildAnthropicRequestCostSql(alias = 'llm_requests'): string {
	const prefix = alias ? `${alias}.` : '';
	const inputTokens = `COALESCE(${prefix}input_no_cache_tokens, MAX(0, COALESCE(${prefix}input_tokens, 0) - COALESCE(${prefix}input_cache_read_tokens, 0) - COALESCE(${prefix}input_cache_write_tokens, 0)))`;
	const readTokens = `COALESCE(${prefix}input_cache_read_tokens, 0)`;
	const writeTokens = `COALESCE(${prefix}input_cache_write_tokens, 0)`;
	const outputTokens = `COALESCE(${prefix}output_tokens, 0)`;

	const model = `LOWER(COALESCE(${prefix}model, ''))`;
	const pricingCase = `CASE
		WHEN ${model} IN ('claude-opus-4-6', 'claude-opus-4-5') THEN
			((${inputTokens}) * 5 + (${readTokens}) * 0.5 + (${writeTokens}) * 6.25 + (${outputTokens}) * 25) / 1000000.0
		WHEN ${model} IN ('claude-opus-4-1', 'claude-opus-4') THEN
			((${inputTokens}) * 15 + (${readTokens}) * 1.5 + (${writeTokens}) * 18.75 + (${outputTokens}) * 75) / 1000000.0
		WHEN ${model} IN ('claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4', 'claude-sonnet-3-7') THEN
			((${inputTokens}) * 3 + (${readTokens}) * 0.3 + (${writeTokens}) * 3.75 + (${outputTokens}) * 15) / 1000000.0
		WHEN ${model} IN ('claude-haiku-4-5') THEN
			((${inputTokens}) * 1 + (${readTokens}) * 0.1 + (${writeTokens}) * 1.25 + (${outputTokens}) * 5) / 1000000.0
		WHEN ${model} IN ('claude-haiku-3-5') THEN
			((${inputTokens}) * 0.8 + (${readTokens}) * 0.08 + (${writeTokens}) * 1 + (${outputTokens}) * 4) / 1000000.0
		WHEN ${model} IN ('claude-opus-3') THEN
			((${inputTokens}) * 15 + (${readTokens}) * 1.5 + (${writeTokens}) * 18.75 + (${outputTokens}) * 75) / 1000000.0
		WHEN ${model} IN ('claude-haiku-3') THEN
			((${inputTokens}) * 0.25 + (${readTokens}) * 0.03 + (${writeTokens}) * 0.3 + (${outputTokens}) * 1.25) / 1000000.0
		ELSE 0
	END`;

	return `CASE
		WHEN COALESCE(${prefix}cost_usd, 0) <> 0 THEN COALESCE(${prefix}cost_usd, 0)
		WHEN COALESCE(${prefix}provider, '') LIKE 'anthropic%' THEN COALESCE(${pricingCase}, 0)
		ELSE 0
	END`;
}

export function allocatePromptCostByTokens(
	tokenCounts: number[],
	totalPromptCostUsd: number
): number[] {
	if (tokenCounts.length === 0 || totalPromptCostUsd <= 0) {
		return tokenCounts.map(() => 0);
	}

	const totalTokens = tokenCounts.reduce((sum, tokens) => sum + Math.max(0, tokens), 0);
	if (totalTokens <= 0) {
		return tokenCounts.map(() => 0);
	}

	return tokenCounts.map((tokens) => (Math.max(0, tokens) / totalTokens) * totalPromptCostUsd);
}
