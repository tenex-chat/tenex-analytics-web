<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { telemetry } from '$lib/stores/telemetry.js';
	import { filters, filterParams } from '$lib/stores/filters.js';
	import { formatNumber, formatCost, formatPercent } from '$lib/utils/format.js';

	async function loadSummary() {
		const params: Record<string, string> = {};
		// Parse all current filter params from the derived store string
		new URLSearchParams($filterParams).forEach((value, key) => {
			params[key] = value;
		});
		await telemetry.fetchAll(params);
	}

	$: $filterParams, loadSummary();

	$: summary = $telemetry.summary;
	$: loading = $telemetry.loading;
	$: error = $telemetry.error;

	// Token usage chart data
	let tokenPoints: Array<Record<string, number | string>> = [];
	let tokenLoading = true;
	let tokenError: string | null = null;

	async function loadTokens() {
		tokenLoading = true;
		tokenError = null;
		try {
			const res = await fetch(`/api/tokens?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			tokenPoints = data.points ?? [];
		} catch (e) {
			tokenError = (e as Error).message;
		} finally {
			tokenLoading = false;
		}
	}

	// Cache chart data
	let cacheByModel: Array<Record<string, number | string>> = [];
	let cacheLoading = true;
	let cacheError: string | null = null;

	async function loadCache() {
		cacheLoading = true;
		cacheError = null;
		try {
			const res = await fetch(`/api/cache?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			cacheByModel = data.byModel ?? [];
		} catch (e) {
			cacheError = (e as Error).message;
		} finally {
			cacheLoading = false;
		}
	}

	$: $filterParams, loadTokens();
	$: $filterParams, loadCache();
</script>

<svelte:head>
	<title>TENEX Analytics</title>
</svelte:head>

<!-- Metrics strip — no card wrapper -->
<dl class="metrics">
	<div class="metric">
		<dt>Total Tokens</dt>
		<dd>{loading ? '—' : formatNumber(summary?.totalTokens ?? 0)}</dd>
	</div>
	<div class="metric">
		<dt>Cache Hit Rate</dt>
		<dd class="accent-green">{loading ? '—' : formatPercent(summary?.cacheEfficiencyPercent ?? 0)}</dd>
	</div>
	<div class="metric">
		<dt>Total Cost</dt>
		<dd>{loading ? '—' : formatCost(summary?.totalCostUsd ?? 0)}</dd>
	</div>
	<div class="metric last">
		<dt>Requests</dt>
		<dd>{loading ? '—' : formatNumber(summary?.totalRequests ?? 0)}</dd>
	</div>
</dl>

<!-- Section: Token Usage -->
<section class="chart-section" style="margin-top: 48px;">
	<h2 class="section-label">Token Usage</h2>
	<Card title="Token Usage Over Time" loading={tokenLoading} error={tokenError}>
		<LineChart
			data={tokenPoints}
			lines={[
				{ key: 'inputTokens', label: 'Input', color: '#a1a1aa' },
				{ key: 'outputTokens', label: 'Output', color: '#22c55e' },
				{ key: 'cacheReadTokens', label: 'Cache Read', color: '#eab308' }
			]}
			xKey="date"
			height={240}
		/>
	</Card>
</section>

<!-- Section: Cache by Model -->
<section class="chart-section" style="margin-top: 40px;">
	<h2 class="section-label">Cache by Model</h2>
	<Card title="Cache Performance by Model" loading={cacheLoading} error={cacheError}>
		<BarChart
			data={cacheByModel}
			bars={[{ key: 'efficiencyPercent', label: 'Efficiency %', color: '#22c55e' }]}
			xKey="label"
			height={200}
			horizontal={true}
		/>
	</Card>
</section>

<style>
	/* Metrics strip */
	.metrics {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.metric {
		flex: 1;
		padding: 0 32px;
		border-right: 1px solid var(--border);
	}

	.metric:first-child {
		padding-left: 0;
	}

	.metric.last {
		border-right: none;
	}

	.metric dt {
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.metric dd {
		font-size: 28px;
		font-weight: 600;
		color: var(--text);
		line-height: 1;
		margin: 0;
	}

	.metric dd.accent-green {
		color: var(--green);
	}

	/* Section headers */
	.section-label {
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dim);
		margin: 0 0 16px 0;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}

	.chart-section {
		margin-bottom: 40px;
	}
</style>
