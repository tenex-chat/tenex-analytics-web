<script lang="ts">
	let dark = true;

	function toggle() {
		dark = !dark;
		document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
	}
</script>

<button class="theme-toggle" onclick={toggle} title="Toggle theme" aria-label="Toggle theme">
	{dark ? '☀' : '🌙'}
</button>

<style>
	.theme-toggle {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--muted);
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
		border-color: var(--muted);
		color: var(--text);
	}
</style>
