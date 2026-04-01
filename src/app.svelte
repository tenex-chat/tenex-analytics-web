<script lang="ts">
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme.js';

	onMount(() => {
		// Apply theme class to document root on load
		const unsubscribe = theme.subscribe((value) => {
			if (value === 'dark') {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		});
		return unsubscribe;
	});
</script>

<slot />
