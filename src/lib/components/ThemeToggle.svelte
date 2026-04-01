<script lang="ts">
	let dark = true;

	function toggle() {
		dark = !dark;
		document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
	}
</script>

<button class="theme-toggle" on:click={toggle} title="Toggle theme" aria-label="Toggle theme">
	{dark ? '☀' : '🌙'}
</button>

<style>
	.theme-toggle {
		background: transparent;
		border: 1px solid var(--color-border, #1f2937);
		border-radius: 0.375rem;
		color: var(--color-text-secondary, #9ca3af);
		cursor: pointer;
		font-size: 1rem;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		line-height: 1;
	}

	.theme-toggle:hover {
		border-color: var(--color-accent, #7c3aed);
		color: var(--color-text-primary, #f3f4f6);
	}
</style>
