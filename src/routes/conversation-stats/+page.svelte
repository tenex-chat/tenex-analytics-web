<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import { formatNumber } from '$lib/utils/format.js';
	import { CHART_COLORS, SERIES_COLORS } from '$lib/utils/colors.js';

	type Summary = {
		totalConversations: number;
		avgRequestsPerConversation: number;
		avgTokensPerConversation: number;
		avgCostPerConversation: number;
		avgDurationSeconds: number;
	};

	type BucketItem = { bucket: string; count: number };
	type LabelItem = { label: string; count: number };
	type DailyItem = { date: string; count: number };
	type WeeklyItem = { week: string; avgRequests: number };
	type GrowthItem = { date: string; avgFirstTokens: number; avgLastTokens: number };
	type PositionItem = { position: number; avgTokens: number };
	type ExpensiveItem = {
		conversationId: string;
		agentSlug: string;
		projectId: string;
		totalCost: number;
		requestCount: number;
		totalTokens: number;
	};

	let summary: Summary = $state({
		totalConversations: 0,
		avgRequestsPerConversation: 0,
		avgTokensPerConversation: 0,
		avgCostPerConversation: 0,
		avgDurationSeconds: 0
	});
	let lengthDistribution: BucketItem[] = $state([]);
	let tokenDistribution: BucketItem[] = $state([]);
	let costDistribution: BucketItem[] = $state([]);
	let dailyNewConversations: DailyItem[] = $state([]);
	let weeklyAvgRequests: WeeklyItem[] = $state([]);
	let tokenGrowth: GrowthItem[] = $state([]);
	let toolStripping: LabelItem[] = $state([]);
	let contextPressure: LabelItem[] = $state([]);
	let topExpensive: ExpensiveItem[] = $state([]);
	let avgTokensPerRequestByPosition: PositionItem[] = $state([]);

	let loading = $state(true);
	let error: string | null = $state(null);

	async function fetchData() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/conversation-stats?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			summary = data.summary ?? summary;
			lengthDistribution = data.lengthDistribution ?? [];
			tokenDistribution = data.tokenDistribution ?? [];
			costDistribution = data.costDistribution ?? [];
			dailyNewConversations = data.dailyNewConversations ?? [];
			weeklyAvgRequests = data.weeklyAvgRequests ?? [];
			tokenGrowth = data.tokenGrowth ?? [];
			toolStripping = data.toolStripping ?? [];
			contextPressure = data.contextPressure ?? [];
			topExpensive = data.topExpensive ?? [];
			avgTokensPerRequestByPosition = data.avgTokensPerRequestByPosition ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		$filterParams;
		fetchData();
	});

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		const m = Math.floor(seconds / 60);
		const s = Math.round(seconds % 60);
		return `${m}m ${s}s`;
	}

	function formatCost(usd: number): string {
		return `$${usd.toFixed(4)}`;
	}

	// Convert position-based data to use string keys for BarChart
	const positionData = $derived(avgTokensPerRequestByPosition.map((p) => ({
		pos: `#${p.position}`,
		avgTokens: p.avgTokens
	})));

	// Convert label-based data to use string keys for BarChart
	const toolStrippingData = $derived(toolStripping.map((t) => ({ label: t.label, count: t.count })));
	const contextPressureData = $derived(contextPressure.map((c) => ({ label: c.label, count: c.count })));
</script>

<svelte:head><title>Conversation Stats — TENEX Analytics</title></svelte:head>

<div class="page">
	<div class="page-header">
		<h1 class="page-title">Conversation Stats</h1>
	</div>

	<!-- Summary metrics strip -->
	<dl class="metrics">
		<div class="metric">
			<dt>Total Conversations</dt>
			<dd>{loading ? '—' : formatNumber(summary.totalConversations)}</dd>
		</div>
		<div class="metric">
			<dt>Avg Length</dt>
			<dd>{loading ? '—' : summary.avgRequestsPerConversation.toFixed(1)} <span class="unit">reqs</span></dd>
		</div>
		<div class="metric">
			<dt>Avg Tokens / Conv</dt>
			<dd>{loading ? '—' : formatNumber(Math.round(summary.avgTokensPerConversation))}</dd>
		</div>
		<div class="metric">
			<dt>Avg Cost / Conv</dt>
			<dd>{loading ? '—' : formatCost(summary.avgCostPerConversation)}</dd>
		</div>
		<div class="metric last">
			<dt>Avg Duration</dt>
			<dd>{loading ? '—' : formatDuration(summary.avgDurationSeconds)}</dd>
		</div>
	</dl>

	<!-- Row 1: length + cost distributions -->
	<div class="chart-grid">
		<Card title="Conversation Length Distribution" {loading} {error}>
			<BarChart
				data={lengthDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: CHART_COLORS.primary }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
		<Card title="Cost Distribution" {loading} {error}>
			<BarChart
				data={costDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: CHART_COLORS.yellow }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
	</div>

	<!-- New conversations over time -->
	<Card title="New Conversations Per Day" {loading} {error}>
		<LineChart
			data={dailyNewConversations}
			lines={[{ key: 'count', label: 'New Conversations', color: CHART_COLORS.green }]}
			xKey="date"
			height={280}
		/>
	</Card>

	<!-- Row 2: weekly avg requests + token distribution -->
	<div class="chart-grid">
		<Card title="Weekly Avg Requests per Conversation" {loading} {error}>
			<LineChart
				data={weeklyAvgRequests}
				lines={[{ key: 'avgRequests', label: 'Avg Requests', color: CHART_COLORS.primary }]}
				xKey="week"
				height={260}
			/>
		</Card>
		<Card title="Token Usage Distribution" {loading} {error}>
			<BarChart
				data={tokenDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[2] }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
	</div>

	<!-- Token growth over time -->
	<Card title="Token Growth Over Conversation Lifetime" {loading} {error}>
		<LineChart
			data={tokenGrowth}
			lines={[
				{ key: 'avgFirstTokens', label: 'First Request Tokens', color: CHART_COLORS.primary },
				{ key: 'avgLastTokens', label: 'Last Request Tokens', color: CHART_COLORS.red }
			]}
			xKey="date"
			height={280}
		/>
	</Card>

	<!-- Row 3: tokens by position + context pressure -->
	<div class="chart-grid">
		<Card title="Avg Tokens by Request Position (1–10)" {loading} {error}>
			<BarChart
				data={positionData}
				bars={[{ key: 'avgTokens', label: 'Avg Tokens', color: CHART_COLORS.secondary }]}
				xKey="pos"
				height={260}
			/>
		</Card>
		<Card title="Context Window Pressure" {loading} {error}>
			<BarChart
				data={contextPressureData}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[3] }]}
				xKey="label"
				height={260}
				horizontal={true}
			/>
		</Card>
	</div>

	<!-- Row 4: tool stripping -->
	<div class="chart-grid">
		<Card title="Tool Stripping Prevalence" {loading} {error}>
			<BarChart
				data={toolStrippingData}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[4] }]}
				xKey="label"
				height={260}
				horizontal={true}
			/>
		</Card>
		<Card title="Conversation Length vs Token Usage" {loading} {error}>
			{#if lengthDistribution.length === 0}
				<p class="empty">No data available</p>
			{:else}
				<BarChart
					data={lengthDistribution}
					bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[1] }]}
					xKey="bucket"
					height={260}
				/>
			{/if}
		</Card>
	</div>

	<!-- Top expensive conversations table -->
	<Card title="Top 10 Most Expensive Conversations" {loading} {error}>
		{#if topExpensive.length === 0}
			<p class="empty">No data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Conversation ID</th>
							<th>Agent</th>
							<th>Project</th>
							<th class="num">Requests</th>
							<th class="num">Tokens</th>
							<th class="num">Cost</th>
						</tr>
					</thead>
					<tbody>
						{#each topExpensive as conv}
							<tr>
								<td class="mono">{conv.conversationId.slice(0, 8)}…</td>
								<td>{conv.agentSlug || '—'}</td>
								<td>{conv.projectId || '—'}</td>
								<td class="num">{conv.requestCount}</td>
								<td class="num">{formatNumber(conv.totalTokens)}</td>
								<td class="num bold">{formatCost(conv.totalCost)}</td>
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

	.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
	@media (max-width: 768px) { .chart-grid { grid-template-columns: 1fr; } }

	/* Metrics strip */
	.metrics { display: flex; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; gap: 0; }
	.metric { flex: 1; min-width: 140px; padding: 0 24px; border-right: 1px solid var(--border); }
	.metric:first-child { padding-left: 0; }
	.metric.last { border-right: none; }
	.metric dt { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
	.metric dd { font-size: 24px; font-weight: 600; color: var(--text); line-height: 1; margin: 0; }
	.unit { font-size: 14px; font-weight: 400; color: var(--muted); }

	/* Table */
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.bold { font-weight: 600; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
