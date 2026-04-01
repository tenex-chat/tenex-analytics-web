<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
</script>

<div class="app-shell">
	<Header />
	<main class="main-content">
		<slot />
	</main>
</div>

<style>
	.app-shell {
		min-height: 100vh;
		background: var(--color-bg-primary, #030712);
		color: var(--color-text-primary, #f1f5f9);
	}

	.main-content {
		max-width: 80rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}
</style>
