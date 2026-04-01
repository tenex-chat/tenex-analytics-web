<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import { formatPercent } from '$lib/utils/format.js';

	interface AgentSummary { agentSlug: string; avgUtilization: number; maxUtilization: number; pruneCount: number; }
	interface ContextEvent { timestamp: string; agentSlug: string; model: string; tokensBefore: number; tokensAfter: number; utilization: number; strategy: string; }

	let byAgent: AgentSummary[] = [];
	let events: ContextEvent[] = [];
	let loading = true;
	let error: string | null = null;

	onMount(async () => {
		try {
			const params = new URLSearchParams($page.url.searchParams);
			const res = await fetch(`/api/context-windows?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			byAgent = data.byAgent ?? [];
			events = data.events ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>Context Windows — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Context Windows</h1>

	{#if error}
		<div class="error-banner">{error}</div>
	{/if}

	<Card title="Agent Utilization Summary" {loading}>
		{#if byAgent.length === 0}
			<p class="empty">No context window data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Agent</th>
							<th class="num">Avg Utilization</th>
							<th class="num">Max Utilization</th>
							<th class="num">Prune Count</th>
						</tr>
					</thead>
					<tbody>
						{#each byAgent as a}
							<tr>
								<td>{a.agentSlug}</td>
								<td class="num">{formatPercent(a.avgUtilization)}</td>
								<td class="num" class:high={a.maxUtilization > 80}>
									{formatPercent(a.maxUtilization)}
								</td>
								<td class="num">{a.pruneCount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<Card title="Recent Pruning Events" {loading}>
		{#if events.length === 0}
			<p class="empty">No events available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Agent</th>
							<th>Model</th>
							<th class="num">Tokens Before</th>
							<th class="num">Tokens After</th>
							<th class="num">Utilization</th>
							<th>Strategy</th>
						</tr>
					</thead>
					<tbody>
						{#each events as e}
							<tr>
								<td class="mono">{e.timestamp?.slice(0, 19) ?? '—'}</td>
								<td>{e.agentSlug}</td>
								<td class="model">{e.model}</td>
								<td class="num">{e.tokensBefore.toLocaleString()}</td>
								<td class="num">{e.tokensAfter.toLocaleString()}</td>
								<td class="num" class:high={e.utilization > 80}>{formatPercent(e.utilization)}</td>
								<td>{e.strategy}</td>
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
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.high { color: var(--red); font-weight: 600; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.model { font-size: 0.75rem; color: var(--muted); }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
	.error-banner { background: #7f1d1d; border: 1px solid var(--red); color: #fca5a5; padding: 0.75rem 1rem; border-radius: var(--radius); font-size: 0.875rem; }
</style>
