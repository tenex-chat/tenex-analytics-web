<script lang="ts">
	import { browser } from '$app/environment';
	import { filters } from '$lib/stores/filters.js';
	import { formatDate } from '$lib/utils/format.js';
	import {
		DEFAULT_PRESET,
		buildFilterSearchParams,
		createDefaultFilters,
		hasFilterQueryParams,
		parseFiltersFromSearchParams
	} from '$lib/stores/filters.js';
	import type { FilterState, TimePreset } from '$lib/stores/filters.js';

	interface FilterOptions {
		projects: string[];
		agents: string[];
		providers: string[];
		models: string[];
		apiKeyIdentities: string[];
	}

	let options: FilterOptions = $state({
		projects: [],
		agents: [],
		providers: [],
		models: [],
		apiKeyIdentities: []
	});
	const FILTER_STORAGE_KEY = 'tenex.analytics.filters';
	let filtersHydrated = $state(false);
	let optionsLoaded = $state(false);

	// Local bound values for custom date pickers
	let fromVal = $state(formatDate($filters.from));
	let toVal = $state(formatDate($filters.to));
	let projectVal = $state($filters.project ?? '');
	let agentVal = $state($filters.agent ?? '');
	let modelVal = $state($filters.model ?? '');
	let apiKeyVal = $state($filters.apiKey ?? '');

	const PRESETS: { label: string; value: TimePreset }[] = [
		{ label: '15m', value: '15m' },
		{ label: '1h', value: '1h' },
		{ label: '4h', value: '4h' },
		{ label: '12h', value: '12h' },
		{ label: '24h', value: '24h' },
		{ label: 'Custom', value: 'custom' }
	];

	function syncInputsFromFilters(state: FilterState) {
		fromVal = formatDate(state.from);
		toVal = formatDate(state.to);
		projectVal = state.project ?? '';
		agentVal = state.agent ?? '';
		modelVal = state.model ?? '';
		apiKeyVal = state.apiKey ?? '';
	}

	function hydrateFilters() {
		if (filtersHydrated) return;
		if (!browser) {
			filtersHydrated = true;
			return;
		}

		const urlParams = new URLSearchParams(window.location.search);
		if (hasFilterQueryParams(urlParams)) {
			filters.set(parseFiltersFromSearchParams(urlParams, createDefaultFilters()));
		} else {
			const storedParams = localStorage.getItem(FILTER_STORAGE_KEY);
			if (storedParams) {
				const persistedSearchParams = new URLSearchParams(storedParams);
				if (hasFilterQueryParams(persistedSearchParams)) {
					filters.set(parseFiltersFromSearchParams(persistedSearchParams, createDefaultFilters()));
				}
			}
		}
		syncInputsFromFilters($filters);
		filtersHydrated = true;
	}

	async function loadOptions() {
		if (optionsLoaded) return;
		optionsLoaded = true;
		try {
			const res = await fetch('/api/filters');
			if (res.ok) options = await res.json();
		} catch {
			// ignore — empty options is fine
		}
	}

	$effect(() => {
		hydrateFilters();
		void loadOptions();
	});

	$effect(() => {
		syncInputsFromFilters($filters);
	});

	$effect(() => {
		if (!filtersHydrated || !browser) return;
		localStorage.setItem(FILTER_STORAGE_KEY, buildFilterSearchParams($filters).toString());
	});

	function applyPreset(preset: TimePreset) {
		filters.setPreset(preset);
	}

	function applyFrom(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		fromVal = val;
		if (val) filters.update((s) => ({ ...s, from: new Date(val), preset: 'custom' }));
	}

	function applyTo(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		toVal = val;
		if (val) filters.update((s) => ({ ...s, to: new Date(val), preset: 'custom' }));
	}

	function applyProject(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		projectVal = val;
		filters.update((s) => ({ ...s, project: val || null }));
	}

	function applyAgent(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		agentVal = val;
		filters.update((s) => ({ ...s, agent: val || null }));
	}

	function applyModel(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		modelVal = val;
		filters.update((s) => ({ ...s, model: val || null }));
	}

	function applyApiKey(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		apiKeyVal = val;
		filters.update((s) => ({ ...s, apiKey: val || null }));
	}

	function reset() {
		filters.reset();
	}

	const activePreset = $derived($filters.preset);
	const hasFilters = $derived(
		activePreset !== DEFAULT_PRESET ||
			!!(
				$filters.project ||
				$filters.agent ||
				$filters.provider ||
				$filters.model ||
				$filters.apiKey
			)
	);
</script>

<div class="filter-bar">
	<div class="filter-row">
		<div class="filter-group">
			<span class="filter-label">Time Range</span>
			<div class="preset-group">
				{#each PRESETS as p}
					<button
						class="preset-btn"
						class:active={activePreset === p.value}
						onclick={() => applyPreset(p.value)}
					>
						{p.label}
					</button>
				{/each}
			</div>
		</div>

		{#if activePreset === 'custom'}
			<div class="filter-group">
				<label class="filter-label" for="date-from">From</label>
				<input
					id="date-from"
					type="date"
					class="filter-input"
					value={fromVal}
					onchange={applyFrom}
				/>
			</div>

			<div class="filter-group">
				<label class="filter-label" for="date-to">To</label>
				<input id="date-to" type="date" class="filter-input" value={toVal} onchange={applyTo} />
			</div>
		{/if}

		{#if options.projects.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="project-filter">Project</label>
				<select
					id="project-filter"
					class="filter-select"
					value={projectVal}
					onchange={applyProject}
				>
					<option value="">All</option>
					{#each options.projects as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if options.agents.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="agent-filter">Agent</label>
				<select id="agent-filter" class="filter-select" value={agentVal} onchange={applyAgent}>
					<option value="">All</option>
					{#each options.agents as a}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if options.models.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="model-filter">Model</label>
				<select id="model-filter" class="filter-select" value={modelVal} onchange={applyModel}>
					<option value="">All</option>
					{#each options.models as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if options.apiKeyIdentities.length > 0}
			<div class="filter-group">
				<label class="filter-label" for="apikey-filter">API Key</label>
				<select id="apikey-filter" class="filter-select" value={apiKeyVal} onchange={applyApiKey}>
					<option value="">All</option>
					{#each options.apiKeyIdentities as k}
						<option value={k}>{k}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if hasFilters}
			<button class="clear-btn" onclick={reset}>Reset</button>
		{/if}
	</div>
</div>

<style>
	.filter-bar {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding: 0.625rem 1.5rem;
	}

	.filter-row {
		max-width: 80rem;
		margin: 0 auto;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.filter-label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.preset-group {
		display: flex;
		gap: 0;
		height: 2rem;
	}

	.preset-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--muted);
		font-size: 0.8125rem;
		padding: 0 0.75rem;
		cursor: pointer;
		margin-left: -1px;
		transition:
			color 0.1s,
			background 0.1s;
	}

	.preset-btn:first-child {
		border-radius: var(--radius) 0 0 var(--radius);
		margin-left: 0;
	}

	.preset-btn:last-child {
		border-radius: 0 var(--radius) var(--radius) 0;
	}

	.preset-btn:hover {
		color: var(--text);
		border-color: var(--muted);
		z-index: 1;
		position: relative;
	}

	.preset-btn.active {
		background: var(--muted);
		color: var(--bg);
		border-color: var(--muted);
		z-index: 2;
		position: relative;
	}

	.filter-select,
	.filter-input {
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		border-radius: var(--radius);
		padding: 0.3rem 0.5rem;
		font-size: 0.8125rem;
		min-width: 7rem;
		height: 2rem;
	}

	.filter-select:focus,
	.filter-input:focus {
		outline: none;
		border-color: var(--muted);
	}

	.clear-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--muted);
		border-radius: var(--radius);
		padding: 0.3rem 0.75rem;
		font-size: 0.8125rem;
		cursor: pointer;
		height: 2rem;
		align-self: flex-end;
	}

	.clear-btn:hover {
		border-color: var(--muted);
		color: var(--text);
	}
</style>
