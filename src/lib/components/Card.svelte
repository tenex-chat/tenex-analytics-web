<script lang="ts">
	// Reusable card container with optional title and loading/error states

	export let title: string = '';
	export let loading: boolean = false;
	export let error: string | null = null;
	export let class_: string = '';
</script>

<div class="card {class_}">
	{#if title}
		<div class="card-header">
			<h3 class="card-title">{title}</h3>
		</div>
	{/if}

	{#if loading}
		<div class="card-loading">
			<div class="spinner" aria-label="Loading…"></div>
		</div>
	{:else if error}
		<div class="card-error" role="alert">
			<p>{error}</p>
		</div>
	{:else}
		<div class="card-body">
			<slot />
		</div>
	{/if}
</div>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 1.25rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	.card-header {
		margin-bottom: 1rem;
	}

	.card-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.card-body {
		min-height: 2rem;
	}

	.card-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 6rem;
	}

	.spinner {
		width: 1.5rem;
		height: 1.5rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-error {
		padding: 0.75rem;
		background: var(--color-error-bg, #fef2f2);
		border-radius: 0.25rem;
		color: var(--color-error, #b91c1c);
		font-size: 0.875rem;
	}

	.card-error p {
		margin: 0;
	}
</style>
