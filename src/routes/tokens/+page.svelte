<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
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
			const res = await fetch(`/api/tokens?${$filterParams}&granularity=${granularity}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			points = data.points ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		$filterParams;
		granularity;
		fetchData();
	});

	const totalInput = $derived(points.reduce((s, p) => s + p.inputTokens, 0));
	const totalOutput = $derived(points.reduce((s, p) => s + p.outputTokens, 0));
	const totalCacheRead = $derived(points.reduce((s, p) => s + p.cacheReadTokens, 0));
	const totalCacheWrite = $derived(points.reduce((s, p) => s + p.cacheWriteTokens, 0));
	const topPoints = $derived([...points].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 10));
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
					onclick={() => { granularity = g; }}
				>{g}</button>
			{/each}
		</div>
	</div>

	<!-- Summary metrics strip -->
	<dl class="metrics">
		<div class="metric">
			<dt>Total Input</dt>
			<dd>{loading ? '—' : formatNumber(totalInput)}</dd>
		</div>
		<div class="metric">
			<dt>Total Output</dt>
			<dd>{loading ? '—' : formatNumber(totalOutput)}</dd>
		</div>
		<div class="metric">
			<dt>Cache Read</dt>
			<dd class="accent-green">{loading ? '—' : formatNumber(totalCacheRead)}</dd>
		</div>
		<div class="metric last">
			<dt>Cache Write</dt>
			<dd>{loading ? '—' : formatNumber(totalCacheWrite)}</dd>
		</div>
	</dl>

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

	/* Metrics strip */
	.metrics { display: flex; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; gap: 0; }
	.metric { flex: 1; min-width: 140px; padding: 0 24px; border-right: 1px solid var(--border); }
	.metric:first-child { padding-left: 0; }
	.metric.last { border-right: none; }
	.metric dt { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
	.metric dd { font-size: 24px; font-weight: 600; color: var(--text); line-height: 1; margin: 0; }
	.metric dd.accent-green { color: var(--green); }

	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.bold { font-weight: 600; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
