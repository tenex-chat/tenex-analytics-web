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
	<title>TENEX Analytics Dashboard</title>
</svelte:head>

<div class="dashboard">
	<div class="page-header">
		<h1 class="page-title">Analytics Dashboard</h1>
		{#if summary?.dateRange?.from}
			<p class="page-subtitle">
				{summary.dateRange.from} → {summary.dateRange.to}
			</p>
		{/if}
	</div>

	<!-- Summary metrics -->
	<section class="metrics-grid">
		<Card title="Total Tokens" {loading} error={error ?? null}>
			<div class="metric-value">{formatNumber(summary?.totalTokens ?? 0)}</div>
			<div class="metric-sub">
				<span class="metric-label">Input:</span> {formatNumber(summary?.totalInputTokens ?? 0)}
				&nbsp;·&nbsp;
				<span class="metric-label">Output:</span> {formatNumber(summary?.totalOutputTokens ?? 0)}
			</div>
		</Card>

		<Card title="Cache Efficiency" {loading} error={error ?? null}>
			<div class="metric-value accent">{formatPercent(summary?.cacheEfficiencyPercent ?? 0)}</div>
			<div class="metric-sub">
				<span class="metric-label">Read:</span> {formatNumber(summary?.totalCacheReadTokens ?? 0)}
				&nbsp;·&nbsp;
				<span class="metric-label">Write:</span> {formatNumber(summary?.totalCacheWriteTokens ?? 0)}
			</div>
		</Card>

		<Card title="Total Cost" {loading} error={error ?? null}>
			<div class="metric-value">{formatCost(summary?.totalCostUsd ?? 0)}</div>
			<div class="metric-sub">
				<span class="metric-label">Requests:</span> {formatNumber(summary?.totalRequests ?? 0)}
			</div>
		</Card>
	</section>

	<!-- Placeholder sections for future charts -->
	<section class="charts-grid">
		<Card title="Token Usage Over Time" {loading}>
			<div class="chart-placeholder">
				<p class="placeholder-text">Token trend chart — Phase 2</p>
			</div>
		</Card>

		<Card title="Cache Performance by Model" {loading}>
			<div class="chart-placeholder">
				<p class="placeholder-text">Cache breakdown chart — Phase 2</p>
			</div>
		</Card>
	</section>
</div>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.page-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 0;
	}

	.page-subtitle {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #94a3b8);
		margin: 0;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
	}

	:global(.metric-value) {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text-primary);
		line-height: 1;
		margin-bottom: 0.5rem;
	}

	:global(.metric-value.accent) {
		color: var(--color-accent, #7c3aed);
	}

	.metric-sub {
		font-size: 0.75rem;
		color: var(--color-text-secondary, #94a3b8);
	}

	:global(.metric-label) {
		font-weight: 500;
		color: var(--color-text-secondary, #64748b);
	}

	.chart-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 160px;
		border: 2px dashed var(--color-border, #334155);
		border-radius: 0.375rem;
	}

	.placeholder-text {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #64748b);
		margin: 0;
	}
</style>
