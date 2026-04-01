<script lang="ts">
	import { onMount } from 'svelte';
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

	type SortCol = keyof Conversation;
	type SortDir = 'asc' | 'desc';

	let conversations: Conversation[] = [];
	let loading = true;
	let error: string | null = null;
	let sortCol: SortCol = 'lastTimestamp';
	let sortDir: SortDir = 'desc';

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

	let mounted = false;
	onMount(() => {
		mounted = true;
		load();
	});

	$: if (mounted) $filterParams, load();

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
							<th on:click={() => setSort('lastTimestamp')} class:active={sortCol === 'lastTimestamp'}>
								Last Seen{#if sortCol === 'lastTimestamp'}<span class="arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>{/if}
							</th>
						</tr>
					</thead>
					<tbody>
						{#each sorted as c}
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
	.data-table th { text-align: left; padding: 0.5rem 0.75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; white-space: nowrap; cursor: pointer; user-select: none; }
	.data-table th:hover { color: var(--text); }
	.data-table th.active { color: var(--text); }
	.data-table td { padding: 0.5rem 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); }
	.data-table tr:last-child td { border-bottom: none; }
	.clickable { cursor: pointer; }
	.clickable:hover td { background: var(--surface); }
	.num { text-align: right; }
	.mono { font-family: monospace; font-size: 0.75rem; }
	.dim { color: var(--muted); }
	.empty { color: var(--muted); font-size: 0.875rem; padding: 1rem 0; }
	.arrow { color: var(--text); font-size: 0.75rem; }
</style>
