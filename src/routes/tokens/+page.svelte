<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import {
		formatDateDisplay,
		formatDateTimeDisplay,
		formatNumber,
		formatPercent
	} from '$lib/utils/format.js';
	import { CHART_COLORS } from '$lib/utils/colors.js';

	type Granularity = 'hour' | 'day' | 'week';
	type TokenPoint = {
		date: string;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		totalTokens: number;
		requests: number;
	};

	type BreakdownItem = {
		key: string;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		totalTokens: number;
		requests: number;
		avgTokensPerRequest: number;
		sharePercent: number;
	};

	type ConversationBreakdownItem = {
		conversationId: string;
		projectId: string;
		agentSlug: string;
		apiKeyIdentity: string;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		totalTokens: number;
		requests: number;
		avgTokensPerRequest: number;
		sharePercent: number;
		lastTimestamp: string | null;
	};

	type RunawayItem = ConversationBreakdownItem & {
		suspiciousScore: number;
		severity: 'high' | 'medium' | 'low';
		requestsPerMinute: number;
		avgToolCallsPerRequest: number;
		avgToolResultsPerRequest: number;
		contextEventsPerRequest: number;
		inputGrowthRatio: number;
		repeatedFsReadMax: number;
		repeatedFsReadPath: string | null;
		repeatedShellCommandMax: number;
		repeatedShellCommand: string | null;
		flags: string[];
	};

	let points: TokenPoint[] = $state([]);
	let projectBreakdown: BreakdownItem[] = $state([]);
	let agentBreakdown: BreakdownItem[] = $state([]);
	let apiKeyBreakdown: BreakdownItem[] = $state([]);
	let topConversations: ConversationBreakdownItem[] = $state([]);
	let runawaySessions: RunawayItem[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);
	let granularity: Granularity = $state('day');
	const granularities: Granularity[] = ['day', 'hour', 'week'];

	async function fetchData() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/tokens?${$filterParams}&granularity=${granularity}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			points = data.points ?? [];
			projectBreakdown = data.breakdown?.projects ?? [];
			agentBreakdown = data.breakdown?.agents ?? [];
			apiKeyBreakdown = data.breakdown?.apiKeys ?? [];
			topConversations = data.breakdown?.conversations ?? [];
			runawaySessions = data.breakdown?.runaways ?? [];
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

	const totalInput = $derived(points.reduce((sum, point) => sum + point.inputTokens, 0));
	const totalOutput = $derived(points.reduce((sum, point) => sum + point.outputTokens, 0));
	const totalCacheRead = $derived(points.reduce((sum, point) => sum + point.cacheReadTokens, 0));
	const totalCacheWrite = $derived(points.reduce((sum, point) => sum + point.cacheWriteTokens, 0));
	const totalTokens = $derived(points.reduce((sum, point) => sum + point.totalTokens, 0));
	const totalRequests = $derived(points.reduce((sum, point) => sum + point.requests, 0));
	const topPeriods = $derived(
		[...points].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 10)
	);

	function displayValue(value: string) {
		return value === '(none)' ? 'None' : value;
	}

	function formatPeriodLabel(date: string) {
		return granularity === 'hour' ? formatDateTimeDisplay(date) : formatDateDisplay(date);
	}

	function truncateText(value: string | null, max = 48) {
		if (!value) return '—';
		return value.length > max ? `${value.slice(0, max - 1)}…` : value;
	}
</script>

<svelte:head><title>Token Analysis — TENEX Analytics</title></svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1 class="page-title">Token Analysis</h1>
			<p class="page-copy">
				Every table below uses the active filters. This shows where the filtered token usage
				actually went across projects, agents, API keys, and the top 50 conversations.
			</p>
		</div>
		<div class="granularity-toggle">
			{#each granularities as g}
				<button
					class="toggle-btn"
					class:active={granularity === g}
					onclick={() => {
						granularity = g;
					}}>{g}</button
				>
			{/each}
		</div>
	</div>

	<dl class="metrics">
		<div class="metric">
			<dt>Total Tokens</dt>
			<dd>{loading ? '—' : formatNumber(totalTokens)}</dd>
		</div>
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
		<div class="metric">
			<dt>Cache Write</dt>
			<dd>{loading ? '—' : formatNumber(totalCacheWrite)}</dd>
		</div>
		<div class="metric last">
			<dt>Requests</dt>
			<dd>{loading ? '—' : formatNumber(totalRequests)}</dd>
		</div>
	</dl>

	<Card title="Token Usage Over Time" {loading} {error}>
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

	<Card title="Runaway Sessions Detector" {loading} {error}>
		{#if runawaySessions.length === 0}
			<p class="empty">
				No conversations in the current filtered slice crossed the runaway threshold.
			</p>
		{:else}
			<p class="section-copy">
				Flagged from the same filtered token slice using requests/minute, tool-call density, context
				churn, prompt growth, and repeated `fs_read` or `shell` loops.
			</p>
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Conversation</th>
							<th>Severity</th>
							<th>Why Flagged</th>
							<th class="num">Score</th>
							<th class="num">Total</th>
							<th class="num">Req</th>
							<th class="num">Req / Min</th>
							<th class="num">Tool / Req</th>
							<th class="num">Ctx / Req</th>
							<th class="num">Input Growth</th>
							<th>Hot Loop</th>
						</tr>
					</thead>
					<tbody>
						{#each runawaySessions as item}
							<tr
								class="clickable"
								onclick={() => goto(`/conversations/${encodeURIComponent(item.conversationId)}`)}
							>
								<td>
									<div class="cell-stack">
										<span class="mono">{item.conversationId.slice(0, 12)}</span>
										<span class="dim small"
											>{displayValue(item.projectId)} · {displayValue(item.apiKeyIdentity)}</span
										>
									</div>
								</td>
								<td>
									<span class="severity severity-{item.severity}">{item.severity}</span>
								</td>
								<td>
									<div class="flag-list">
										{#each item.flags as flag}
											<span class="flag-chip">{flag}</span>
										{/each}
									</div>
								</td>
								<td class="num bold">{item.suspiciousScore}</td>
								<td class="num">{formatNumber(item.totalTokens)}</td>
								<td class="num">{formatNumber(item.requests)}</td>
								<td class="num">{item.requestsPerMinute.toFixed(1)}</td>
								<td class="num">{item.avgToolCallsPerRequest.toFixed(1)}</td>
								<td class="num">{item.contextEventsPerRequest.toFixed(1)}</td>
								<td class="num">{item.inputGrowthRatio.toFixed(1)}x</td>
								<td>
									<div class="cell-stack">
										{#if item.repeatedFsReadMax > 0}
											<span class="small">`fs_read` × {formatNumber(item.repeatedFsReadMax)}</span>
											<span class="dim small">{truncateText(item.repeatedFsReadPath)}</span>
										{:else if item.repeatedShellCommandMax > 0}
											<span class="small"
												>`shell` × {formatNumber(item.repeatedShellCommandMax)}</span
											>
											<span class="dim small">{truncateText(item.repeatedShellCommand)}</span>
										{:else}
											<span class="dim small">—</span>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<div class="grid-two">
		<Card title="Projects by Token Usage" {loading} {error}>
			{#if projectBreakdown.length === 0}
				<p class="empty">No project data available</p>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>Project</th>
								<th class="num">Share</th>
								<th class="num">Total</th>
								<th class="num">Input</th>
								<th class="num">Output</th>
								<th class="num">Cache Read</th>
								<th class="num">Requests</th>
								<th class="num">Avg / Req</th>
							</tr>
						</thead>
						<tbody>
							{#each projectBreakdown as item}
								<tr>
									<td class="truncate">{displayValue(item.key)}</td>
									<td class="num">{formatPercent(item.sharePercent)}</td>
									<td class="num bold">{formatNumber(item.totalTokens)}</td>
									<td class="num">{formatNumber(item.inputTokens)}</td>
									<td class="num">{formatNumber(item.outputTokens)}</td>
									<td class="num">{formatNumber(item.cacheReadTokens)}</td>
									<td class="num">{formatNumber(item.requests)}</td>
									<td class="num">{formatNumber(item.avgTokensPerRequest)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		<Card title="Agents by Token Usage" {loading} {error}>
			{#if agentBreakdown.length === 0}
				<p class="empty">No agent data available</p>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>Agent</th>
								<th class="num">Share</th>
								<th class="num">Total</th>
								<th class="num">Input</th>
								<th class="num">Output</th>
								<th class="num">Cache Read</th>
								<th class="num">Requests</th>
								<th class="num">Avg / Req</th>
							</tr>
						</thead>
						<tbody>
							{#each agentBreakdown as item}
								<tr>
									<td class="truncate">{displayValue(item.key)}</td>
									<td class="num">{formatPercent(item.sharePercent)}</td>
									<td class="num bold">{formatNumber(item.totalTokens)}</td>
									<td class="num">{formatNumber(item.inputTokens)}</td>
									<td class="num">{formatNumber(item.outputTokens)}</td>
									<td class="num">{formatNumber(item.cacheReadTokens)}</td>
									<td class="num">{formatNumber(item.requests)}</td>
									<td class="num">{formatNumber(item.avgTokensPerRequest)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>
	</div>

	<div class="grid-two">
		<Card title="API Keys by Token Usage" {loading} {error}>
			{#if apiKeyBreakdown.length === 0}
				<p class="empty">No API key data available</p>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>API Key</th>
								<th class="num">Share</th>
								<th class="num">Total</th>
								<th class="num">Input</th>
								<th class="num">Output</th>
								<th class="num">Cache Read</th>
								<th class="num">Requests</th>
								<th class="num">Avg / Req</th>
							</tr>
						</thead>
						<tbody>
							{#each apiKeyBreakdown as item}
								<tr>
									<td class="truncate">{displayValue(item.key)}</td>
									<td class="num">{formatPercent(item.sharePercent)}</td>
									<td class="num bold">{formatNumber(item.totalTokens)}</td>
									<td class="num">{formatNumber(item.inputTokens)}</td>
									<td class="num">{formatNumber(item.outputTokens)}</td>
									<td class="num">{formatNumber(item.cacheReadTokens)}</td>
									<td class="num">{formatNumber(item.requests)}</td>
									<td class="num">{formatNumber(item.avgTokensPerRequest)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		<Card title="Top Periods by Token Usage" {loading} {error}>
			{#if topPeriods.length === 0}
				<p class="empty">No data available</p>
			{:else}
				<div class="table-wrap">
					<table class="data-table">
						<thead>
							<tr>
								<th>Period</th>
								<th class="num">Input</th>
								<th class="num">Output</th>
								<th class="num">Cache Read</th>
								<th class="num">Total</th>
								<th class="num">Requests</th>
							</tr>
						</thead>
						<tbody>
							{#each topPeriods as point}
								<tr>
									<td>{formatPeriodLabel(point.date)}</td>
									<td class="num">{formatNumber(point.inputTokens)}</td>
									<td class="num">{formatNumber(point.outputTokens)}</td>
									<td class="num">{formatNumber(point.cacheReadTokens)}</td>
									<td class="num bold">{formatNumber(point.totalTokens)}</td>
									<td class="num">{formatNumber(point.requests)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>
	</div>

	<Card title="Top 50 Conversations by Token Usage" {loading} {error}>
		{#if topConversations.length === 0}
			<p class="empty">No conversation data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Conversation</th>
							<th>Agent</th>
							<th>Project</th>
							<th>API Key</th>
							<th class="num">Share</th>
							<th class="num">Total</th>
							<th class="num">Input</th>
							<th class="num">Output</th>
							<th class="num">Requests</th>
							<th class="num">Avg / Req</th>
							<th>Last Seen</th>
						</tr>
					</thead>
					<tbody>
						{#each topConversations as item}
							<tr
								class="clickable"
								onclick={() => goto(`/conversations/${encodeURIComponent(item.conversationId)}`)}
							>
								<td class="mono">{item.conversationId.slice(0, 8)}</td>
								<td class="truncate">{displayValue(item.agentSlug)}</td>
								<td class="truncate">{displayValue(item.projectId)}</td>
								<td class="truncate">{displayValue(item.apiKeyIdentity)}</td>
								<td class="num">{formatPercent(item.sharePercent)}</td>
								<td class="num bold">{formatNumber(item.totalTokens)}</td>
								<td class="num">{formatNumber(item.inputTokens)}</td>
								<td class="num">{formatNumber(item.outputTokens)}</td>
								<td class="num">{formatNumber(item.requests)}</td>
								<td class="num">{formatNumber(item.avgTokensPerRequest)}</td>
								<td class="dim"
									>{item.lastTimestamp ? formatDateTimeDisplay(item.lastTimestamp) : '—'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.page-copy {
		color: var(--muted);
		font-size: 0.875rem;
		margin: 0.375rem 0 0;
		max-width: 56rem;
	}

	.section-copy {
		color: var(--muted);
		font-size: 0.8125rem;
		margin: 0 0 1rem;
		max-width: 64rem;
	}

	.grid-two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	@media (max-width: 960px) {
		.grid-two {
			grid-template-columns: 1fr;
		}
	}

	.granularity-toggle {
		display: flex;
		gap: 0.25rem;
	}

	.toggle-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--muted);
		padding: 0.375rem 0.875rem;
		border-radius: var(--radius);
		font-size: 0.8125rem;
		cursor: pointer;
		text-transform: capitalize;
	}

	.toggle-btn.active {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
	}

	.metrics {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
		flex-wrap: wrap;
		gap: 0;
	}

	.metric {
		flex: 1;
		min-width: 140px;
		padding: 0 24px;
		border-right: 1px solid var(--border);
	}

	.metric:first-child {
		padding-left: 0;
	}

	.metric.last {
		border-right: none;
	}

	.metric dt {
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin-bottom: 6px;
	}

	.metric dd {
		font-size: 24px;
		font-weight: 600;
		color: var(--text);
		line-height: 1;
		margin: 0;
	}

	.metric dd.accent-green {
		color: var(--green);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	.data-table th {
		text-align: left;
		padding: 0.5rem 0.75rem;
		color: var(--muted);
		border-bottom: 1px solid var(--border);
		font-weight: 500;
		white-space: nowrap;
	}

	.data-table td {
		padding: 0.5rem 0.75rem;
		color: var(--text);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.data-table tr:last-child td {
		border-bottom: none;
	}

	.data-table tr.clickable {
		cursor: pointer;
	}

	.data-table tr.clickable:hover td {
		background: var(--surface);
	}

	.num {
		text-align: right;
	}

	.bold {
		font-weight: 600;
	}

	.dim {
		color: var(--muted);
	}

	.small {
		font-size: 0.75rem;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.cell-stack {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.flag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		max-width: 24rem;
	}

	.flag-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 9999px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.6875rem;
		line-height: 1.2;
	}

	.severity {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		border: 1px solid var(--border);
		background: var(--surface);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.severity-high {
		color: var(--red);
	}

	.severity-medium {
		color: #d4d4d8;
	}

	.severity-low {
		color: var(--muted);
	}

	.truncate {
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty {
		color: var(--muted);
		font-size: 0.875rem;
		padding: 1rem 0;
	}
</style>
