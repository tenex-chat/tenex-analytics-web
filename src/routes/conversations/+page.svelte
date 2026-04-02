<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import BarChart from '$lib/components/BarChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import { formatNumber, formatCost } from '$lib/utils/format.js';
	import { CHART_COLORS, SERIES_COLORS } from '$lib/utils/colors.js';

	// --- Conversation list ---

	interface Conversation {
		conversationId: string;
		agentSlug: string;
		projectId: string;
		totalTokens: number;
		totalCost: number;
		requestCount: number;
		lastTimestamp: string;
		cacheEfficiency: number;
	}

	type SortCol = keyof Conversation;
	type SortDir = 'asc' | 'desc';

	let conversations: Conversation[] = [];
	let listLoading = true;
	let listError: string | null = null;
	let sortCol: SortCol = 'lastTimestamp';
	let sortDir: SortDir = 'desc';

	async function loadList() {
		listLoading = true;
		listError = null;
		try {
			const res = await fetch(`/api/conversations?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			conversations = (data.conversations ?? []).slice(0, 50);
		} catch (e) {
			listError = (e as Error).message;
		} finally {
			listLoading = false;
		}
	}

	let mounted = false;
	onMount(() => {
		mounted = true;
		loadList();
		fetchStats();
	});

	$: if (mounted) $filterParams, loadList(), fetchStats();

	$: sorted = [...conversations].sort((a, b) => {
		const av = a[sortCol];
		const bv = b[sortCol];
		const cmp = typeof av === 'number' && typeof bv === 'number'
			? av - bv
			: String(av).localeCompare(String(bv));
		return sortDir === 'asc' ? cmp : -cmp;
	});

	function setSort(col: SortCol) {
		if (sortCol === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = col;
			sortDir = col === 'lastTimestamp' ? 'desc' : 'asc';
		}
	}

	function truncate(s: string, n = 20) {
		return s.length > n ? s.slice(0, n) + '…' : s;
	}

	// --- Conversation stats ---

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

	let summary: Summary = {
		totalConversations: 0,
		avgRequestsPerConversation: 0,
		avgTokensPerConversation: 0,
		avgCostPerConversation: 0,
		avgDurationSeconds: 0
	};
	let lengthDistribution: BucketItem[] = [];
	let tokenDistribution: BucketItem[] = [];
	let costDistribution: BucketItem[] = [];
	let dailyNewConversations: DailyItem[] = [];
	let weeklyAvgRequests: WeeklyItem[] = [];
	let tokenGrowth: GrowthItem[] = [];
	let toolStripping: LabelItem[] = [];
	let contextPressure: LabelItem[] = [];
	let topExpensive: ExpensiveItem[] = [];
	let avgTokensPerRequestByPosition: PositionItem[] = [];

	let statsLoading = true;
	let statsError: string | null = null;

	async function fetchStats() {
		statsLoading = true;
		statsError = null;
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
			statsError = (e as Error).message;
		} finally {
			statsLoading = false;
		}
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		const m = Math.floor(seconds / 60);
		const s = Math.round(seconds % 60);
		return `${m}m ${s}s`;
	}

	$: positionData = avgTokensPerRequestByPosition.map((p) => ({
		pos: `#${p.position}`,
		avgTokens: p.avgTokens
	}));

	$: toolStrippingData = toolStripping.map((t) => ({ label: t.label, count: t.count }));
	$: contextPressureData = contextPressure.map((c) => ({ label: c.label, count: c.count }));
</script>

<svelte:head><title>Conversations — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Conversations</h1>

	<!-- Summary metrics strip -->
	<dl class="metrics">
		<div class="metric">
			<dt>Total Conversations</dt>
			<dd>{statsLoading ? '—' : formatNumber(summary.totalConversations)}</dd>
		</div>
		<div class="metric">
			<dt>Avg Length</dt>
			<dd>{statsLoading ? '—' : summary.avgRequestsPerConversation.toFixed(1)} <span class="unit">reqs</span></dd>
		</div>
		<div class="metric">
			<dt>Avg Tokens / Conv</dt>
			<dd>{statsLoading ? '—' : formatNumber(Math.round(summary.avgTokensPerConversation))}</dd>
		</div>
		<div class="metric">
			<dt>Avg Cost / Conv</dt>
			<dd>{statsLoading ? '—' : formatCost(summary.avgCostPerConversation)}</dd>
		</div>
		<div class="metric last">
			<dt>Avg Duration</dt>
			<dd>{statsLoading ? '—' : formatDuration(summary.avgDurationSeconds)}</dd>
		</div>
	</dl>

	<!-- Row 1: length + cost distributions -->
	<div class="chart-grid">
		<Card title="Conversation Length Distribution" loading={statsLoading} error={statsError}>
			<BarChart
				data={lengthDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: CHART_COLORS.primary }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
		<Card title="Cost Distribution" loading={statsLoading} error={statsError}>
			<BarChart
				data={costDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: CHART_COLORS.yellow }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
	</div>

	<!-- New conversations over time -->
	<Card title="New Conversations Per Day" loading={statsLoading} error={statsError}>
		<LineChart
			data={dailyNewConversations}
			lines={[{ key: 'count', label: 'New Conversations', color: CHART_COLORS.green }]}
			xKey="date"
			height={280}
		/>
	</Card>

	<!-- Row 2: weekly avg requests + token distribution -->
	<div class="chart-grid">
		<Card title="Weekly Avg Requests per Conversation" loading={statsLoading} error={statsError}>
			<LineChart
				data={weeklyAvgRequests}
				lines={[{ key: 'avgRequests', label: 'Avg Requests', color: CHART_COLORS.primary }]}
				xKey="week"
				height={260}
			/>
		</Card>
		<Card title="Token Usage Distribution" loading={statsLoading} error={statsError}>
			<BarChart
				data={tokenDistribution}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[2] }]}
				xKey="bucket"
				height={260}
			/>
		</Card>
	</div>

	<!-- Token growth over time -->
	<Card title="Token Growth Over Conversation Lifetime" loading={statsLoading} error={statsError}>
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
		<Card title="Avg Tokens by Request Position (1–10)" loading={statsLoading} error={statsError}>
			<BarChart
				data={positionData}
				bars={[{ key: 'avgTokens', label: 'Avg Tokens', color: CHART_COLORS.secondary }]}
				xKey="pos"
				height={260}
			/>
		</Card>
		<Card title="Context Window Pressure" loading={statsLoading} error={statsError}>
			<BarChart
				data={contextPressureData}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[3] }]}
				xKey="label"
				height={260}
				horizontal={true}
			/>
		</Card>
	</div>

	<!-- Row 4: tool stripping + length vs tokens -->
	<div class="chart-grid">
		<Card title="Tool Stripping Prevalence" loading={statsLoading} error={statsError}>
			<BarChart
				data={toolStrippingData}
				bars={[{ key: 'count', label: 'Conversations', color: SERIES_COLORS[4] }]}
				xKey="label"
				height={260}
				horizontal={true}
			/>
		</Card>
		<Card title="Conversation Length vs Token Usage" loading={statsLoading} error={statsError}>
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
	<Card title="Top 10 Highest Token Conversations" loading={statsLoading} error={statsError}>
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
						</tr>
					</thead>
					<tbody>
						{#each topExpensive as conv}
							<tr>
								<td class="mono">{conv.conversationId.slice(0, 4)}</td>
								<td>{conv.agentSlug || '—'}</td>
								<td>{conv.projectId || '—'}</td>
								<td class="num">{conv.requestCount}</td>
								<td class="num bold">{formatNumber(conv.totalTokens)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<!-- Divider before list -->
	<div class="section-divider">
		<span class="section-label">All Conversations</span>
	</div>

	<!-- Conversation list -->
	<Card title={`${conversations.length} Conversations`} loading={listLoading} error={listError}>
		{#if conversations.length === 0}
			<p class="empty">No conversation data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th on:click={() => setSort('conversationId')} class:active={sortCol === 'conversationId'}>
								Conversation ID{#if sortCol === 'conversationId'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th on:click={() => setSort('agentSlug')} class:active={sortCol === 'agentSlug'}>
								Agent{#if sortCol === 'agentSlug'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th on:click={() => setSort('projectId')} class:active={sortCol === 'projectId'}>
								Project{#if sortCol === 'projectId'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th class="num" on:click={() => setSort('totalTokens')} class:active={sortCol === 'totalTokens'}>
								Tokens{#if sortCol === 'totalTokens'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th class="num" on:click={() => setSort('totalCost')} class:active={sortCol === 'totalCost'}>
								Cost{#if sortCol === 'totalCost'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th class="num" on:click={() => setSort('requestCount')} class:active={sortCol === 'requestCount'}>
								Requests{#if sortCol === 'requestCount'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th class="num" on:click={() => setSort('cacheEfficiency')} class:active={sortCol === 'cacheEfficiency'}>
								Cache %{#if sortCol === 'cacheEfficiency'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
							<th on:click={() => setSort('lastTimestamp')} class:active={sortCol === 'lastTimestamp'}>
								Last Seen{#if sortCol === 'lastTimestamp'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
						</tr>
					</thead>
					<tbody>
						{#each sorted as c}
							<tr class="clickable" on:click={() => goto(`/conversations/${encodeURIComponent(c.conversationId)}`)}>
								<td class="mono">{c.conversationId.slice(0, 4)}</td>
								<td>{c.agentSlug}</td>
								<td class="dim">{truncate(c.projectId, 20)}</td>
								<td class="num">{formatNumber(c.totalTokens)}</td>
								<td class="num">{formatCost(c.totalCost)}</td>
								<td class="num">{c.requestCount}</td>
								<td class="num">{(c.cacheEfficiency ?? 0).toFixed(1)}%</td>
								<td class="dim">{c.lastTimestamp?.slice(0, 10) ?? '—'}</td>
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

	/* Section divider */
	.section-divider { display: flex; align-items: center; gap: 1rem; }
	.section-divider::before,
	.section-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
	.section-label { font-size: 0.75rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); white-space: nowrap; }

	/* Table */
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; white-space: nowrap; cursor: pointer; user-select: none; }
	.data-table th:hover { color: var(--text); }
	.data-table th.active { color: var(--text); }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.clickable { cursor: pointer; }
	.clickable:hover td { background: var(--surface); }
	.num { text-align: right; }
	.bold { font-weight: 600; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.dim { color: var(--muted); }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
	.arrow { color: var(--text); font-size: 0.75rem; }
</style>
