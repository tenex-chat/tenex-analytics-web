<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface Filters {
		projects: string[];
		agents: string[];
		providers: string[];
		models: string[];
	}

	let filters: Filters = { projects: [], agents: [], providers: [], models: [] };

	// Current selections — read from URL
	$: params = $page.url.searchParams;
	$: selectedProject = params.get('project') ?? '';
	$: selectedAgent = params.get('agent') ?? '';
	$: selectedProvider = params.get('provider') ?? '';
	$: selectedModel = params.get('model') ?? '';
	$: selectedFrom = params.get('from') ?? '';
	$: selectedTo = params.get('to') ?? '';

	onMount(async () => {
		try {
			const res = await fetch('/api/filters');
			if (res.ok) filters = await res.json();
		} catch {
			// ignore — empty filters is fine
		}
	});

	function updateParam(key: string, value: string) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}

	function clearAll() {
		const url = new URL($page.url);
		['project', 'agent', 'provider', 'model', 'from', 'to'].forEach((k) => url.searchParams.delete(k));
		goto(url.toString(), { replaceState: true });
	}

	$: hasFilters = selectedProject || selectedAgent || selectedProvider || selectedModel || selectedFrom || selectedTo;
</script>

<div class="filter-bar">
	<div class="filter-row">
		{#if filters.projects.length > 0}
			<div class="filter-group">
				<label class="filter-label">Project</label>
				<select
					class="filter-select"
					value={selectedProject}
					on:change={(e) => updateParam('project', e.currentTarget.value)}
				>
					<option value="">All</option>
					{#each filters.projects as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if filters.agents.length > 0}
			<div class="filter-group">
				<label class="filter-label">Agent</label>
				<select
					class="filter-select"
					value={selectedAgent}
					on:change={(e) => updateParam('agent', e.currentTarget.value)}
				>
					<option value="">All</option>
					{#each filters.agents as a}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if filters.providers.length > 0}
			<div class="filter-group">
				<label class="filter-label">Provider</label>
				<select
					class="filter-select"
					value={selectedProvider}
					on:change={(e) => updateParam('provider', e.currentTarget.value)}
				>
					<option value="">All</option>
					{#each filters.providers as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if filters.models.length > 0}
			<div class="filter-group">
				<label class="filter-label">Model</label>
				<select
					class="filter-select"
					value={selectedModel}
					on:change={(e) => updateParam('model', e.currentTarget.value)}
				>
					<option value="">All</option>
					{#each filters.models as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="filter-group">
			<label class="filter-label">From</label>
			<input
				type="date"
				class="filter-input"
				value={selectedFrom}
				on:change={(e) => updateParam('from', e.currentTarget.value)}
			/>
		</div>

		<div class="filter-group">
			<label class="filter-label">To</label>
			<input
				type="date"
				class="filter-input"
				value={selectedTo}
				on:change={(e) => updateParam('to', e.currentTarget.value)}
			/>
		</div>

		{#if hasFilters}
			<button class="clear-btn" on:click={clearAll}>Clear</button>
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
