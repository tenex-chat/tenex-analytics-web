<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';
</script>

<header>
	<a href="/" class="brand">TENEX Analytics</a>
	<nav class="nav">
		<a href="/" class="nav-link">Overview</a>
		<a href="/costs" class="nav-link">Cost</a>
		<a href="/context-windows" class="nav-link">Context</a>
		<a href="/conversations" class="nav-link">Conversations</a>
	</nav>
	<div class="header-actions">
		<ThemeToggle />
	</div>
</header>

<style>
	header {
		padding: 0 1.5rem;
		height: 3rem;
		display: flex;
		align-items: center;
		gap: 2rem;
		border-bottom: 1px solid var(--color-border, #1f2937);
		background: var(--color-bg-secondary, #111827);
	}

	.brand {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary, #f3f4f6);
		text-decoration: none;
		white-space: nowrap;
	}

	.brand:hover {
		color: var(--color-accent, #7c3aed);
	}

	.nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
	}

	.nav-link {
		font-size: 0.875rem;
		color: var(--color-text-secondary, #9ca3af);
		text-decoration: none;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		transition: color 0.15s, background 0.15s;
	}

	.nav-link:hover {
		color: var(--color-text-primary, #f3f4f6);
		background: var(--color-bg-primary, #030712);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}
</style>
