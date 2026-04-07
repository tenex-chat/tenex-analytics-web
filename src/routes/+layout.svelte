<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import FilterBar from '$lib/components/FilterBar.svelte';
</script>

<header>
	<div class="header-inner">
		<span class="brand">TENEX Analytics</span>
		<nav>
			<a href="/" class:active={$page.url.pathname === '/'}>Overview</a>
			<a href="/tokens" class:active={$page.url.pathname === '/tokens'}>Tokens</a>
			<a href="/cache" class:active={$page.url.pathname === '/cache'}>Cache</a>
			<a href="/costs" class:active={$page.url.pathname === '/costs'}>Costs</a>
			<a href="/context-windows" class:active={$page.url.pathname === '/context-windows'}>Context</a
			>
			<a href="/conversations" class:active={$page.url.pathname === '/conversations'}
				>Conversations</a
			>
			<a href="/conversation-stats" class:active={$page.url.pathname === '/conversation-stats'}
				>Conv Stats</a
			>
		</nav>
	</div>
</header>
<FilterBar />
<main>
	<slot />
</main>

<style>
	header {
		border-bottom: 1px solid var(--border);
		padding: 0 32px;
		height: 48px;
		display: flex;
		align-items: center;
	}
	.header-inner {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		gap: 32px;
	}
	.brand {
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		white-space: nowrap;
	}
	nav {
		display: flex;
		gap: 24px;
	}
	nav a {
		font-size: 13px;
		color: var(--muted);
		text-decoration: none;
		transition: color 0.15s;
	}
	nav a:hover,
	nav a.active {
		color: var(--text);
	}
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 32px;
	}
</style>
