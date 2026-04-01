<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
</script>

<Header />
<FilterBar />
<main>
	<slot />
</main>

<style>
	main {
		max-width: 80rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}
</style>
