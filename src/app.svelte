<script lang="ts">
	import { theme } from '$lib/stores/theme.js';

	$effect(() => {
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
