<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import { formatNumber, formatPercent } from '$lib/utils/format.js';
	import { CHART_COLORS, getCacheEfficiencyColor } from '$lib/utils/colors.js';

	let overall = { efficiencyPercent: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 };
	let byModel: Array<Record<string, number | string>> = [];
	let byDay: Array<Record<string, number | string>> = [];
	let loading = true;
	let error: string | null = null;

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/cache?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			overall = data.overall ?? overall;
			byModel = data.byModel ?? [];
			byDay = data.byDay ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$: $filterParams, load();

	$: effColor = getCacheEfficiencyColor(overall.efficiencyPercent);
</script>

<svelte:head><title>Cache Efficiency — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Cache Efficiency</h1>

	<!-- Summary metrics strip — no card wrappers -->
	<dl class="metrics">
		<div class="metric">
			<dt>Cache Read Tokens</dt>
			<dd>{loading ? '—' : formatNumber(overall.totalCacheReadTokens)}</dd>
		</div>
		<div class="metric">
			<dt>Cache Write Tokens</dt>
			<dd>{loading ? '—' : formatNumber(overall.totalCacheWriteTokens)}</dd>
		</div>
		<div class="metric last">
			<dt>Overall Efficiency</dt>
			<dd style="color: {effColor}">{loading ? '—' : formatPercent(overall.efficiencyPercent)}</dd>
		</div>
	</dl>

	<Card title="Cache Hit % by Model" {loading} error={error}>
		<BarChart
			data={byModel}
			bars={[{ key: 'efficiencyPercent', label: 'Efficiency %', color: CHART_COLORS.green }]}
			xKey="label"
			height={300}
			horizontal={true}
		/>
	</Card>

	<Card title="Cache Read Tokens Over Time" {loading}>
		<LineChart
			data={byDay}
			lines={[{ key: 'cacheReadTokens', label: 'Cache Read Tokens', color: CHART_COLORS.green }]}
			xKey="label"
			height={260}
		/>
	</Card>

	<!-- Table: model breakdown -->
	<Card title="Cache by Model — Detail" {loading}>
		{#if byModel.length === 0}
			<p class="empty">No data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Model</th>
							<th class="num">Cache Read</th>
							<th class="num">Cache Write</th>
							<th class="num">Total Input</th>
							<th class="num">Efficiency %</th>
						</tr>
					</thead>
					<tbody>
						{#each byModel as row}
							<tr>
								<td>{row.label}</td>
								<td class="num">{formatNumber(Number(row.cacheReadTokens))}</td>
								<td class="num">{formatNumber(Number(row.cacheWriteTokens))}</td>
								<td class="num">{formatNumber(Number(row.inputTokens))}</td>
								<td class="num">{formatPercent(Number(row.efficiencyPercent))}</td>
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
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }

	/* Metrics strip */
	.metrics { display: flex; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; }
	.metric { flex: 1; min-width: 140px; padding: 0 24px; border-right: 1px solid var(--border); }
	.metric:first-child { padding-left: 0; }
	.metric.last { border-right: none; }
	.metric dt { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
	.metric dd { font-size: 24px; font-weight: 600; color: var(--text); line-height: 1; margin: 0; }

	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
