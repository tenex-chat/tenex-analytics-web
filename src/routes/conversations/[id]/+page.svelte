<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Card from '$lib/components/Card.svelte';
	import { formatNumber, formatCost } from '$lib/utils/format.js';

	interface Message { role: string; classification: string; tokenCount: number; contentPreview: string; }
	interface LLMRequest { id: string; timestamp: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; totalCostUsd: number; messages: Message[]; }

	let conversationId = '';
	let requests: LLMRequest[] = [];
	let loading = true;
	let error: string | null = null;
	let expanded = new Set<string>();

	$: id = $page.params.id ?? '';

	onMount(async () => {
		conversationId = id;
		try {
			const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			conversationId = data.conversationId ?? id;
			requests = data.requests ?? [];
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	});

	$: totalTokens = requests.reduce((s, r) => s + r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens, 0);
	$: totalCost = requests.reduce((s, r) => s + r.totalCostUsd, 0);

	function toggleExpand(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
		expanded = new Set(expanded);
	}
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

	<section class="metrics-grid">
		<Card title="Total Tokens" {loading}>
			<div class="metric-value">{formatNumber(totalTokens)}</div>
		</Card>
		<Card title="Total Cost" {loading}>
			<div class="metric-value">{formatCost(totalCost)}</div>
		</Card>
		<Card title="Requests" {loading}>
			<div class="metric-value">{requests.length}</div>
		</Card>
	</section>

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
	.back-link { font-size: 0.875rem; color: var(--color-accent, #8b5cf6); text-decoration: none; }
	.back-link:hover { text-decoration: underline; }
	.page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); }
	.conv-id { font-family: monospace; font-size: 0.8125rem; color: var(--color-text-secondary, #9ca3af); word-break: break-all; }
	.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
	.metric-value { font-size: 2rem; font-weight: 700; color: var(--color-text-primary, #f1f5f9); }
	.timeline { display: flex; flex-direction: column; gap: 0.5rem; }
	.request-card { border: 1px solid var(--color-border, #1f2937); border-radius: 0.5rem; overflow: hidden; }
	.request-header { width: 100%; display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; background: transparent; border: none; cursor: pointer; color: var(--color-text-primary, #f1f5f9); text-align: left; }
	.request-header:hover { background: var(--color-bg-secondary, #111827); }
	.req-meta { display: flex; flex-direction: column; gap: 0.125rem; min-width: 12rem; }
	.req-time { font-family: monospace; font-size: 0.75rem; color: var(--color-text-secondary, #9ca3af); }
	.req-model { font-size: 0.8125rem; font-weight: 500; }
	.req-tokens { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; flex: 1; }
	.token-pill { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 9999px; }
	.token-pill.in { background: #1e1b4b; color: #a5b4fc; }
	.token-pill.out { background: #0c4a6e; color: #7dd3fc; }
	.token-pill.cache { background: #14532d; color: #86efac; }
	.req-cost { font-size: 0.8125rem; color: var(--color-text-secondary, #9ca3af); margin-left: auto; }
	.expand-icon { font-size: 0.6875rem; color: var(--color-text-secondary, #9ca3af); }
	.messages { padding: 0.75rem 1rem; border-top: 1px solid var(--color-border, #1f2937); background: var(--color-bg-secondary, #111827); }
	.msg-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
	.msg-table th { text-align: left; padding: 0.375rem 0.5rem; color: var(--color-text-secondary, #9ca3af); border-bottom: 1px solid var(--color-border, #374151); font-weight: 500; }
	.msg-table td { padding: 0.375rem 0.5rem; color: var(--color-text-primary, #f1f5f9); border-bottom: 1px solid var(--color-border, #1f2937); }
	.msg-table tr:last-child td { border-bottom: none; }
	.num { text-align: right; }
	.dim { color: var(--color-text-secondary, #9ca3af); }
	.preview { font-size: 0.75rem; color: var(--color-text-secondary, #9ca3af); max-width: 30rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.role-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
	.role-user { background: #1e3a5f; color: #93c5fd; }
	.role-assistant { background: #2d1b69; color: #c4b5fd; }
	.role-system { background: #1c1917; color: #d6d3d1; }
	.no-msgs { color: var(--color-text-secondary, #9ca3af); font-size: 0.875rem; }
	.empty { color: var(--color-text-secondary, #9ca3af); font-size: 0.875rem; padding: 1rem 0; }
	.error-banner { background: #7f1d1d; border: 1px solid #ef4444; color: #fca5a5; padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; }
</style>
