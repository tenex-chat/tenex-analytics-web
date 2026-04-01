<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/Card.svelte';
	import { telemetry } from '$lib/stores/telemetry.js';
	import { formatNumber, formatCost, formatPercent } from '$lib/utils/format.js';

	onMount(() => {
		telemetry.fetchAll();
	});

	$: summary = $telemetry.summary;
	$: loading = $telemetry.loading;
	$: error = $telemetry.error;
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
	<Card title="Token Usage Over Time" {loading} error={error ?? null}>
		<div class="chart-placeholder">token trend chart — phase 2</div>
	</Card>
</section>

<!-- Section: Cache by Model -->
<section class="chart-section" style="margin-top: 40px;">
	<h2 class="section-label">Cache by Model</h2>
	<Card title="Cache Performance by Model" {loading} error={error ?? null}>
		<div class="chart-placeholder">cache breakdown chart — phase 2</div>
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

	/* Chart placeholder */
	.chart-placeholder {
		height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		color: var(--dim);
	}
</style>
