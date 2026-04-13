import { describe, it, expect } from 'vitest';
import { buildRequestFilter, parseRequestFilters } from '$lib/server/database.js';

describe('parseRequestFilters', () => {
	it('reads the standard analytics query params', () => {
		const url = new URL(
			'http://localhost/api/telemetry?from=2026-03-01&to=2026-03-31&project=alpha&agent=builder&provider=openai&model=gpt-4o&apiKey=primary'
		);

		expect(parseRequestFilters(url)).toEqual({
			from: '2026-03-01',
			to: '2026-03-31',
			project: 'alpha',
			agent: 'builder',
			provider: 'openai',
			model: 'gpt-4o',
			apiKey: 'primary'
		});
	});
});

describe('buildRequestFilter', () => {
	it('includes date, project, agent, provider, model, apiKey, and success status filters', () => {
		const result = buildRequestFilter({
			from: '2026-03-01',
			to: '2026-03-31',
			project: 'alpha',
			agent: 'builder',
			provider: 'openai',
			model: 'gpt-4o',
			apiKey: 'primary'
		});

		expect(result.clause).toContain("status = 'success'");
		expect(result.clause).toContain('started_at_ms >= @from');
		expect(result.clause).toContain('started_at_ms <= @to');
		expect(result.clause).toContain('project_id = @project');
		expect(result.clause).toContain('agent_slug = @agent');
		expect(result.clause).toContain('provider = @provider');
		expect(result.clause).toContain('model = @model');
		expect(result.clause).toContain('api_key_identity = @apiKey');
		expect(result.params.project).toBe('alpha');
		expect(result.params.agent).toBe('builder');
		expect(result.params.provider).toBe('openai');
		expect(result.params.model).toBe('gpt-4o');
		expect(result.params.apiKey).toBe('primary');
	});

	it('can target a different date column and omit unsupported filters', () => {
		const result = buildRequestFilter(
			{
				from: '2026-03-01',
				to: '2026-03-31',
				project: 'alpha',
				agent: 'builder',
				model: 'gpt-4o'
			},
			{
				dateColumn: 'created_at_ms',
				includeStatus: false,
				includeProject: false,
				includeProvider: false
			}
		);

		expect(result.clause).toContain('created_at_ms >= @from');
		expect(result.clause).toContain('created_at_ms <= @to');
		expect(result.clause).not.toContain('status =');
		expect(result.clause).not.toContain('project_id =');
		expect(result.clause).not.toContain('provider =');
		expect(result.clause).toContain('agent_slug = @agent');
		expect(result.clause).toContain('model = @model');
	});
});
