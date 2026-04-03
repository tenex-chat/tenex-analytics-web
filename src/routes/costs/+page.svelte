<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import { formatCost } from '$lib/utils/format.js';
	import { CHART_COLORS } from '$lib/utils/colors.js';

	let trends: Array<Record<string, number | string>> = [];
	let byModel: Array<Record<string, number | string>> = [];
	let byAgent: Array<Record<string, number | string>> = [];
	let byApiKey: Array<Record<string, number | string>> = [];
	let loading = true;
	let error: string | null = null;

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/cost?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			trends = data.trends ?? [];
			byModel = data.byModel ?? [];
			byAgent = data.byAgent ?? [];
			byApiKey = data.byApiKey ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		$filterParams;
		load();
	});

	const totalCost = $derived(trends.reduce((sum, t) => sum + Number(t.totalCost), 0));
	const modelsUsed = $derived(byModel.length);
	const agentsUsed = $derived(byAgent.length);
</script>

<svelte:head><title>Cost Analysis — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Cost Analysis</h1>

	<!-- Summary metrics strip -->
	<dl class="metrics">
		<div class="metric">
			<dt>Total Cost</dt>
			<dd>{loading ? '—' : formatCost(totalCost)}</dd>
		</div>
		<div class="metric">
			<dt>Models Used</dt>
			<dd>{loading ? '—' : modelsUsed}</dd>
		</div>
		<div class="metric last">
			<dt>Agents Used</dt>
			<dd>{loading ? '—' : agentsUsed}</dd>
		</div>
	</dl>

	<Card title="Daily Cost Over Time" {loading} error={error}>
		<LineChart
			data={trends}
			lines={[{ key: 'totalCost', label: 'Total Cost (USD)', color: CHART_COLORS.yellow }]}
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

		{#if byApiKey.length > 0}
			<Card title="Cost by API Key">
				<BarChart
					data={byApiKey}
					bars={[{ key: 'totalCost', label: 'Cost (USD)', color: CHART_COLORS.yellow }]}
					xKey="apiKeyIdentity"
					height={300}
					horizontal={true}
				/>
			</Card>
		{/if}
	</div>

	<!-- Table: cost by model -->
	<Card title="Cost by Model — Detail" {loading}>
		{#if byModel.length === 0}
			<p class="empty">No data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Model</th>
							<th class="num">Total Cost</th>
						</tr>
					</thead>
					<tbody>
						{#each byModel as row}
							<tr>
								<td>{row.model}</td>
								<td class="num">{formatCost(Number(row.totalCost), 4)}</td>
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

	.charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1rem; }
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
