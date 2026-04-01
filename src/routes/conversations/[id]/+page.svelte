<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import { formatNumber, formatCost } from '$lib/utils/format.js';
	import { SERIES_COLORS } from '$lib/utils/colors.js';
	import type { ConversationStats } from '$lib/api/types.js';

	interface Message { role: string; classification: string; tokenCount: number; contentPreview: string; }
	interface LLMRequest { id: string; timestamp: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; totalCostUsd: number; messages: Message[]; }

	let conversationId = '';
	let requests: LLMRequest[] = [];
	let loading = true;
	let error: string | null = null;
	let expanded = new Set<string>();

	let stats: ConversationStats | null = null;
	let statsLoading = true;
	let statsError: string | null = null;

	$: id = $page.params.id ?? '';

	onMount(async () => {
		conversationId = id;
		const encodedId = encodeURIComponent(id);

		const [detailRes, statsRes] = await Promise.allSettled([
			fetch(`/api/conversations/${encodedId}`),
			fetch(`/api/conversations/${encodedId}/stats`)
		]);

		// Detail
		if (detailRes.status === 'fulfilled') {
			try {
				if (!detailRes.value.ok) throw new Error(`HTTP ${detailRes.value.status}`);
				const data = await detailRes.value.json();
				conversationId = data.conversationId ?? id;
				requests = data.requests ?? [];
			} catch (e) {
				error = (e as Error).message;
			}
		} else {
			error = detailRes.reason?.message ?? 'Failed to load';
		}
		loading = false;

		// Stats
		if (statsRes.status === 'fulfilled') {
			try {
				if (!statsRes.value.ok) throw new Error(`HTTP ${statsRes.value.status}`);
				stats = await statsRes.value.json();
			} catch (e) {
				statsError = (e as Error).message;
			}
		} else {
			statsError = statsRes.reason?.message ?? 'Failed to load stats';
		}
		statsLoading = false;
	});

	$: totalTokens = requests.reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);
	$: totalCost = requests.reduce((s, r) => s + r.totalCostUsd, 0);

	function toggleExpand(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
		expanded = new Set(expanded);
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		return `${(seconds / 3600).toFixed(1)}h`;
	}

	$: chartData = stats?.timeSeries.map((p, i) => ({
		label: `#${i + 1}`,
		tokensUsed: p.tokensUsed,
		messageCount: p.messageCount,
		toolCallsStripped: p.toolCallsStripped
	})) ?? [];
</script>

<svelte:head><title>Conversation — TENEX Analytics</title></svelte:head>

<div class="page">
	<div class="page-header">
		<a href="/conversations" class="back-link">← Conversations</a>
		<h1 class="page-title">Conversation Detail</h1>
		<p class="conv-id">{conversationId}</p>
	</div>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<!-- Summary metrics strip — no card wrappers -->
	<dl class="metrics">
		<div class="metric">
			<dt>Total Tokens</dt>
			<dd>{loading ? '—' : formatNumber(totalTokens)}</dd>
		</div>
		<div class="metric">
			<dt>Total Cost</dt>
			<dd>{loading ? '—' : formatCost(totalCost)}</dd>
		</div>
		<div class="metric last">
			<dt>Requests</dt>
			<dd>{loading ? '—' : requests.length}</dd>
		</div>
	</dl>

	<!-- Growth Stats section -->
	<Card title="Conversation Metrics" loading={statsLoading} error={statsError}>
		{#if stats && stats.timeSeries.length > 0}
			<!-- Stat cards row -->
			<dl class="stat-grid">
				<div class="stat">
					<dt>Mean Tokens / Request</dt>
					<dd>{formatNumber(Math.round(stats.summary.meanTokensPerRequest))}</dd>
				</div>
				<div class="stat">
					<dt>Median Tokens</dt>
					<dd>{formatNumber(stats.summary.medianTokens)}</dd>
				</div>
				<div class="stat">
					<dt>Min / Max Tokens</dt>
					<dd>{formatNumber(stats.summary.minTokens)} / {formatNumber(stats.summary.maxTokens)}</dd>
				</div>
				<div class="stat">
					<dt>Avg Messages / Request</dt>
					<dd>{stats.summary.avgMessagesPerRequest.toFixed(1)}</dd>
				</div>
				<div class="stat">
					<dt>Total Tool Calls</dt>
					<dd>{formatNumber(stats.summary.totalToolCalls)}</dd>
				</div>
				<div class="stat">
					<dt>Tool Uses Removed</dt>
					<dd class:highlight-red={stats.summary.totalToolCallsStripped > 0}>{formatNumber(stats.summary.totalToolCallsStripped)}</dd>
				</div>
				<div class="stat last">
					<dt>Duration</dt>
					<dd>{formatDuration(stats.summary.conversationDurationSeconds)}</dd>
				</div>
			</dl>

			<!-- Token growth chart -->
			<div class="chart-section">
				<p class="chart-label">Tokens per Request</p>
				<LineChart
					data={chartData}
					lines={[
						{ key: 'tokensUsed', label: 'Tokens Used', color: SERIES_COLORS[0] },
					]}
					xKey="label"
					height={220}
				/>
			</div>

			{#if stats.timeSeries.some(p => p.messageCount > 0)}
				<div class="chart-section">
					<p class="chart-label">Message Count per Request</p>
					<LineChart
						data={chartData}
						lines={[
							{ key: 'messageCount', label: 'Messages', color: SERIES_COLORS[1] },
						]}
						xKey="label"
						height={180}
					/>
				</div>
			{/if}

			{#if stats.summary.totalToolCallsStripped > 0}
				<div class="chart-section">
					<p class="chart-label">Tool Uses Removed by Anthropic (per Request)</p>
					<LineChart
						data={chartData}
						lines={[
							{ key: 'toolCallsStripped', label: 'Removed', color: SERIES_COLORS[4] },
						]}
						xKey="label"
						height={160}
					/>
				</div>
			{/if}
		{:else if stats}
			<p class="empty">No stats available for this conversation</p>
		{/if}
	</Card>

	<Card title="Request Timeline" {loading}>
		{#if requests.length === 0}
			<p class="empty">No requests found</p>
		{:else}
			<div class="timeline">
				{#each requests as req}
					<div class="request-card">
						<button class="request-header" on:click={() => toggleExpand(req.id)}>
							<div class="req-meta">
								<span class="req-time">{req.timestamp?.slice(0, 19) ?? '—'}</span>
								<span class="req-model">{req.model}</span>
							</div>
							<div class="req-tokens">
								<span class="token-pill in">↑ {formatNumber(req.inputTokens)}</span>
								<span class="token-pill out">↓ {formatNumber(req.outputTokens)}</span>
								{#if req.cacheReadTokens > 0}
									<span class="token-pill cache">⚡ {formatNumber(req.cacheReadTokens)}</span>
								{/if}
								<span class="req-cost">{formatCost(req.totalCostUsd)}</span>
							</div>
							<span class="expand-icon">{expanded.has(req.id) ? '▲' : '▼'}</span>
						</button>

						{#if expanded.has(req.id)}
							<div class="messages">
								{#if req.messages.length === 0}
									<p class="no-msgs">No messages</p>
								{:else}
									<table class="msg-table">
										<thead>
											<tr>
												<th>Role</th>
												<th>Classification</th>
												<th class="num">Tokens</th>
												<th>Preview</th>
											</tr>
										</thead>
										<tbody>
											{#each req.messages as msg}
												<tr>
													<td><span class="role-badge role-{msg.role}">{msg.role}</span></td>
													<td class="dim">{msg.classification || '—'}</td>
													<td class="num">{msg.tokenCount}</td>
													<td class="preview">{msg.contentPreview}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1.5rem; }
	.page-header { display: flex; flex-direction: column; gap: 0.25rem; }
	.back-link { font-size: 0.875rem; color: var(--muted); text-decoration: none; }
	.back-link:hover { color: var(--text); text-decoration: underline; }
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--text); }
	.conv-id { font-family: monospace; font-size: 0.8125rem; color: var(--muted); word-break: break-all; }

	/* Metrics strip */
	.metrics { display: flex; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; }
	.metric { flex: 1; min-width: 140px; padding: 0 24px; border-right: 1px solid var(--border); }
	.metric:first-child { padding-left: 0; }
	.metric.last { border-right: none; }
	.metric dt { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
	.metric dd { font-size: 24px; font-weight: 600; color: var(--text); line-height: 1; margin: 0; }

	/* Stats grid in conversation metrics card */
	.stat-grid { display: flex; margin: 0 0 20px 0; padding: 0; list-style: none; flex-wrap: wrap; gap: 0; }
	.stat { flex: 1; min-width: 120px; padding: 0 20px 16px 0; border-right: 1px solid var(--border); margin-right: 20px; }
	.stat.last { border-right: none; margin-right: 0; }
	.stat dt { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 4px; }
	.stat dd { font-size: 20px; font-weight: 600; color: var(--text); line-height: 1; margin: 0; }
	.stat dd.highlight-red { color: var(--red); }

	.chart-section { margin-top: 16px; }
	.chart-label { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); margin: 0 0 8px 0; }

	.timeline { display: flex; flex-direction: column; gap: 0.5rem; }
	.request-card { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
	.request-header { width: 100%; display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: transparent; border: none; cursor: pointer; color: var(--text); text-align: left; }
	.request-header:hover { background: var(--surface); }
	.req-meta { display: flex; flex-direction: column; gap: 0.125rem; min-width: 12rem; }
	.req-time { font-family: monospace; font-size: 0.75rem; color: var(--muted); }
	.req-model { font-size: 0.8125rem; font-weight: 500; }
	.req-tokens { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1; }
	.token-pill { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 9999px; }
	.token-pill.in { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
	.token-pill.out { background: var(--surface); border: 1px solid var(--border); color: var(--green); }
	.token-pill.cache { background: var(--surface); border: 1px solid var(--border); color: var(--yellow, #eab308); }
	.req-cost { font-size: 0.8125rem; color: var(--muted); margin-left: auto; }
	.expand-icon { font-size: 0.6875rem; color: var(--muted); }
	.messages { padding: 0.75rem 1rem; border-top: 1px solid var(--border); background: var(--surface); }
	.msg-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.msg-table th { text-align: left; padding: 0.375rem 0.5rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.msg-table td { padding: 0.375rem 0.5rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.msg-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.dim { color: var(--muted); }
	.preview { font-size: 0.75rem; color: var(--muted); max-width: 30rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.role-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.role-user { background: var(--surface); border: 1px solid var(--border); color: var(--text); }
	.role-assistant { background: var(--surface); border: 1px solid var(--border); color: var(--muted); }
	.role-system { background: var(--surface); border: 1px solid var(--border); color: var(--dim); }
	.no-msgs { color: var(--muted); font-size: 0.875rem; }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
	.error-banner { background: var(--surface); border: 1px solid var(--red); color: var(--red); padding: 0.75rem 1rem; border-radius: var(--radius); font-size: 0.875rem; }
</style>
