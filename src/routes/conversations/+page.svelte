<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/Card.svelte';
	import { filterParams } from '$lib/stores/filters.js';
	import { formatNumber, formatCost } from '$lib/utils/format.js';

	interface Conversation {
		conversationId: string;
		agentSlug: string;
		projectId: string;
		totalTokens: number;
		totalCost: number;
		requestCount: number;
		lastTimestamp: string;
	}

	let conversations: Conversation[] = [];
	let loading = true;
	let error: string | null = null;

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/conversations?${$filterParams}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			conversations = (data.conversations ?? []).slice(0, 50);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	$: $filterParams, load();

	function truncate(s: string, n = 20) {
		return s.length > n ? s.slice(0, n) + '…' : s;
	}
</script>

<svelte:head><title>Conversations — TENEX Analytics</title></svelte:head>

<div class="page">
	<h1 class="page-title">Conversations</h1>

	<Card title={`${conversations.length} Conversations`} {loading} error={error}>
		{#if conversations.length === 0}
			<p class="empty">No conversation data available</p>
		{:else}
			<div class="table-wrap">
				<table class="data-table">
					<thead>
						<tr>
							<th>Conversation ID</th>
							<th>Agent</th>
							<th>Project</th>
							<th class="num">Tokens</th>
							<th class="num">Cost</th>
							<th class="num">Requests</th>
							<th>Last Seen</th>
						</tr>
					</thead>
					<tbody>
						{#each conversations as c}
							<tr class="clickable" on:click={() => goto(`/conversations/${encodeURIComponent(c.conversationId)}`)}>
								<td class="mono">{truncate(c.conversationId, 24)}</td>
								<td>{c.agentSlug}</td>
								<td class="dim">{truncate(c.projectId, 20)}</td>
								<td class="num">{formatNumber(c.totalTokens)}</td>
								<td class="num">{formatCost(c.totalCost)}</td>
								<td class="num">{c.requestCount}</td>
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
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; white-space: nowrap; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.clickable { cursor: pointer; }
	.clickable:hover td { background: var(--surface); }
	.num { text-align: right; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.dim { color: var(--muted); }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
