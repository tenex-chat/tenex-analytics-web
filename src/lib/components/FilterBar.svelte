<script lang="ts">
	import { onMount } from 'svelte';
	import { filters } from '$lib/stores/filters.js';
	import { formatDate } from '$lib/utils/format.js';

	interface FilterOptions {
		projects: string[];
		agents: string[];
		providers: string[];
		models: string[];
	}

	let options: FilterOptions = { projects: [], agents: [], providers: [], models: [] };

	// Local bound values — sync from store on init
	let fromVal = formatDate($filters.from);
	let toVal = formatDate($filters.to);
	let projectVal = $filters.project ?? '';
	let agentVal = $filters.agent ?? '';
	let modelVal = $filters.model ?? '';

	onMount(async () => {
		try {
			const res = await fetch('/api/filters');
			if (res.ok) options = await res.json();
		} catch {
			// ignore — empty options is fine
		}
	});

	function applyFrom(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		fromVal = val;
		if (val) filters.update((s) => ({ ...s, from: new Date(val) }));
	}

	function applyTo(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		toVal = val;
		if (val) filters.update((s) => ({ ...s, to: new Date(val) }));
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

	function reset() {
		filters.reset();
		fromVal = formatDate($filters.from);
		toVal = formatDate($filters.to);
		projectVal = '';
		agentVal = '';
		modelVal = '';
	}

	$: hasFilters = projectVal || agentVal || modelVal;
</script>

<div class="filter-bar">
	<div class="filter-row">
		<div class="filter-group">
			<label class="filter-label">From</label>
			<input
				type="date"
				class="filter-input"
				value={fromVal}
				on:change={applyFrom}
			/>
		</div>

		<div class="filter-group">
			<label class="filter-label">To</label>
			<input
				type="date"
				class="filter-input"
				value={toVal}
				on:change={applyTo}
			/>
		</div>

		{#if options.projects.length > 0}
			<div class="filter-group">
				<label class="filter-label">Project</label>
				<select class="filter-select" value={projectVal} on:change={applyProject}>
					<option value="">All</option>
					{#each options.projects as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if options.agents.length > 0}
			<div class="filter-group">
				<label class="filter-label">Agent</label>
				<select class="filter-select" value={agentVal} on:change={applyAgent}>
					<option value="">All</option>
					{#each options.agents as a}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if options.models.length > 0}
			<div class="filter-group">
				<label class="filter-label">Model</label>
				<select class="filter-select" value={modelVal} on:change={applyModel}>
					<option value="">All</option>
					{#each options.models as m}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if hasFilters}
			<button class="clear-btn" on:click={reset}>Reset</button>
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
