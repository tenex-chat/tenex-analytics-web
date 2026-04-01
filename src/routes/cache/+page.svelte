<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { formatNumber, formatPercent } from '$lib/utils/format.js';
	import { CHART_COLORS, getCacheEfficiencyColor } from '$lib/utils/colors.js';

	let overall = { efficiencyPercent: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0 };
	let byModel: Array<Record<string, number | string>> = [];
	let byDay: Array<Record<string, number | string>> = [];
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const params = new URLSearchParams($page.url.searchParams);
			const res = await fetch(`/api/cache?${params}`);
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
	});
</script>

<svelte:head><title>Cache Efficiency — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Cache Efficiency</h1>

	<section class="metrics-grid">
		<Card title="Total Cache Reads" {loading}>
			<div class="metric-value">{formatNumber(overall.totalCacheReadTokens)}</div>
			<div class="metric-sub">tokens served from cache</div>
		</Card>
		<Card title="Total Cache Writes" {loading}>
			<div class="metric-value">{formatNumber(overall.totalCacheWriteTokens)}</div>
			<div class="metric-sub">tokens written to cache</div>
		</Card>
		<Card title="Overall Efficiency" {loading}>
			<div class="metric-value" style="color: {getCacheEfficiencyColor(overall.efficiencyPercent)}">
				{formatPercent(overall.efficiencyPercent)}
			</div>
			<div class="metric-sub">cache read / (cache read + input)</div>
		</Card>
	</section>

	<Card title="Cache Hit % by Model" {loading} error={error}>
		<BarChart
			data={byModel}
			bars={[{ key: 'efficiencyPercent', label: 'Efficiency %', color: CHART_COLORS.primary }]}
			xKey="label"
			height={300}
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
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }
	.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
	.metric-value { font-size: 2rem; font-weight: 700; color: var(--text); }
	.metric-sub { font-size: 0.8125rem; color: var(--muted); margin-top: 0.25rem; }
</style>
