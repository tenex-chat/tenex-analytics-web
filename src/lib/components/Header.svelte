<script lang="ts">
	import ThemeToggle from './ThemeToggle.svelte';

	export let title: string = 'TENEX Analytics';
</script>

<header class="app-header">
	<div class="header-inner">
		<div class="header-brand">
			<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-icon" aria-hidden="true">
				<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
			</svg>
			<span class="brand-name">{title}</span>
		</div>
		<nav class="header-nav">
			<ThemeToggle />
		</nav>
	</div>
</header>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--color-bg-secondary, #0f172a);
		border-bottom: 1px solid var(--color-border);
		backdrop-filter: blur(8px);
	}

	.header-inner {
		max-width: 80rem;
		margin: 0 auto;
		padding: 0 1.5rem;
		height: 3.5rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-brand {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		color: var(--color-text-primary);
	}

	.brand-icon {
		color: var(--color-accent, #7c3aed);
	}

	.brand-name {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.header-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
