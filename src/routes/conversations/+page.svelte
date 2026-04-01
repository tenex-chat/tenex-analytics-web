<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
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

	onMount(async () => {
		try {
			const params = new URLSearchParams($page.url.searchParams);
			const res = await fetch(`/api/conversations?${params}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			conversations = data.conversations ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});

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
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); }
	.table-wrap { overflow-x: auto; }
	.data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--color-text-secondary, #9ca3af); border-bottom: 1px solid var(--color-border, #374151); font-weight: 500; white-space: nowrap; }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--color-text-primary, #f1f5f9); border-bottom: 1px solid var(--color-border, #1f2937); }
	.data-table tr:last-child td { border-bottom: none; }
	.clickable { cursor: pointer; }
	.clickable:hover td { background: var(--color-bg-secondary, #111827); }
	.num { text-align: right; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.dim { color: var(--color-text-secondary, #9ca3af); }
	.empty { color: var(--color-text-secondary, #9ca3af); font-size: 0.875rem; padding: 1rem 0; }
</style>
