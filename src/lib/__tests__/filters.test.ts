import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PRESET,
	buildFilterSearchParams,
	createDefaultFilters,
	parseFiltersFromSearchParams
} from '$lib/stores/filters.js';

describe('filters store helpers', () => {
	it('defaults to a 15 minute site-wide window', () => {
		const defaults = createDefaultFilters();

		expect(DEFAULT_PRESET).toBe('15m');
		expect(defaults.preset).toBe('15m');
	});

	it('round-trips explicit sub-day filters through search params', () => {
		const state = {
			...createDefaultFilters(),
			from: new Date('2026-04-13T10:00:00.000Z'),
			to: new Date('2026-04-13T10:15:00.000Z'),
			preset: '15m' as const,
			project: 'proj-1',
			agent: 'agent-1',
			provider: 'anthropic',
			model: 'claude-sonnet',
			apiKey: 'key-1'
		};

		const params = buildFilterSearchParams(state);
		const parsed = parseFiltersFromSearchParams(params, createDefaultFilters());

		expect(params.get('preset')).toBe('15m');
		expect(params.get('from')).toBe('2026-04-13T10:00:00.000Z');
		expect(parsed.preset).toBe('15m');
		expect(parsed.from.toISOString()).toBe('2026-04-13T10:00:00.000Z');
		expect(parsed.to.toISOString()).toBe('2026-04-13T10:15:00.000Z');
		expect(parsed.project).toBe('proj-1');
		expect(parsed.agent).toBe('agent-1');
		expect(parsed.provider).toBe('anthropic');
		expect(parsed.model).toBe('claude-sonnet');
		expect(parsed.apiKey).toBe('key-1');
	});

	it('treats explicit date ranges without a preset as custom filters', () => {
		const params = new URLSearchParams({
			from: '2026-04-01',
			to: '2026-04-02',
			project: 'demo-project'
		});

		const parsed = parseFiltersFromSearchParams(params, createDefaultFilters());

		expect(parsed.preset).toBe('custom');
		expect(parsed.from.toISOString()).toBe('2026-04-01T00:00:00.000Z');
		expect(parsed.to.toISOString()).toBe('2026-04-02T00:00:00.000Z');
		expect(parsed.project).toBe('demo-project');
	});
});
