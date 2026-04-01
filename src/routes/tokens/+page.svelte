<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { formatNumber } from '$lib/utils/format.js';
	import { CHART_COLORS } from '$lib/utils/colors.js';

	type Granularity = 'hour' | 'day' | 'week';
	type TokenPoint = { date: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; totalTokens: number; requests: number };

	let points: TokenPoint[] = [];
	let loading = true;
	let error: string | null = null;
	let granularity: Granularity = 'day';
	const granularities: Granularity[] = ['day', 'hour', 'week'];

	async function fetchData() {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams($page.url.searchParams);
			params.set('granularity', granularity);
			const res = await fetch(`/api/tokens?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			points = data.points ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	onMount(fetchData);

	$: granularity, fetchData();

	$: topPoints = [...points].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 10);
</script>

<svelte:head><title>Token Analysis — TENEX Analytics</title></svelte:head>

<div class="page">
	<div class="page-header">
		<h1 class="page-title">Token Analysis</h1>
		<div class="granularity-toggle">
			{#each granularities as g}
				<button
					class="toggle-btn"
					class:active={granularity === g}
					on:click={() => { granularity = g; }}
				>{g}</button>
			{/each}
		</div>
	</div>

	<Card title="Token Usage Over Time" {loading} error={error}>
		<LineChart
			data={points}
			lines={[
				{ key: 'inputTokens', label: 'Input', color: CHART_COLORS.primary },
				{ key: 'outputTokens', label: 'Output', color: CHART_COLORS.secondary },
				{ key: 'cacheReadTokens', label: 'Cache Read', color: CHART_COLORS.green }
			]}
			xKey="date"
			height={320}
		/>
	</Card>

	<Card title="Top Periods by Token Usage" {loading}>
		{#if topPoints.length === 0}
			<p class="empty">No data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Date</th>
							<th class="num">Input</th>
							<th class="num">Output</th>
							<th class="num">Cache Read</th>
							<th class="num">Total</th>
							<th class="num">Requests</th>
						</tr>
					</thead>
					<tbody>
						{#each topPoints as p}
							<tr>
								<td>{p.date}</td>
								<td class="num">{formatNumber(p.inputTokens)}</td>
								<td class="num">{formatNumber(p.outputTokens)}</td>
								<td class="num">{formatNumber(p.cacheReadTokens)}</td>
								<td class="num bold">{formatNumber(p.totalTokens)}</td>
								<td class="num">{p.requests}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }
	.granularity-toggle { display: flex; gap: 0.25rem; }
	.toggle-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 0.375rem 0.875rem; border-radius: var(--radius); font-size: 0.8125rem; cursor: pointer; text-transform: capitalize; }
	.toggle-btn.active { background: var(--surface); border-color: var(--border); color: var(--text); }
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.bold { font-weight: 600; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
