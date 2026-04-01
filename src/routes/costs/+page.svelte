<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { formatCost } from '$lib/utils/format.js';
	import { CHART_COLORS } from '$lib/utils/colors.js';

	let trends: Array<Record<string, number | string>> = [];
	let byModel: Array<Record<string, number | string>> = [];
	let byAgent: Array<Record<string, number | string>> = [];
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const params = new URLSearchParams($page.url.searchParams);
			const res = await fetch(`/api/cost?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			trends = data.trends ?? [];
			byModel = data.byModel ?? [];
			byAgent = data.byAgent ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});

	$: totalCost = trends.reduce((sum, t) => sum + Number(t.totalCost), 0);
	$: mostExpensiveModel = byModel.length > 0 ? (byModel[0].model as string) : '—';
</script>

<svelte:head><title>Cost Analysis — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Cost Analysis</h1>

	<section class="metrics-grid">
		<Card title="Total Cost" {loading}>
			<div class="metric-value">{formatCost(totalCost)}</div>
		</Card>
		<Card title="Most Expensive Model" {loading}>
			<div class="metric-value model-name">{mostExpensiveModel}</div>
			{#if byModel.length > 0}
				<div class="metric-sub">{formatCost(Number(byModel[0].totalCost))}</div>
			{/if}
		</Card>
	</section>

	<Card title="Daily Cost Over Time" {loading} error={error}>
		<LineChart
			data={trends}
			lines={[{ key: 'totalCost', label: 'Total Cost (USD)', color: CHART_COLORS.warning }]}
			xKey="date"
			height={300}
		/>
	</Card>

	<div class="charts-row">
		<Card title="Cost by Model" {loading}>
			<BarChart
				data={byModel}
				bars={[{ key: 'totalCost', label: 'Cost (USD)', color: CHART_COLORS.primary }]}
				xKey="model"
				height={300}
				horizontal={true}
			/>
		</Card>

		<Card title="Cost by Agent" {loading}>
			<BarChart
				data={byAgent}
				bars={[{ key: 'totalCost', label: 'Cost (USD)', color: CHART_COLORS.secondary }]}
				xKey="agentSlug"
				height={300}
				horizontal={true}
			/>
		</Card>
	</div>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); }
	.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
	.charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1rem; }
	.metric-value { font-size: 2rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); }
	.metric-value.model-name { font-size: 1.125rem; word-break: break-all; }
	.metric-sub { font-size: 0.8125rem; color: var(--color-text-secondary, #9ca3af); margin-top: 0.25rem; }
</style>
