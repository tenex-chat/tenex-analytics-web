<script lang="ts">
	const {
		title = '',
		loading = false,
		error = null,
		class_ = ''
	} = $props<{
		title?: string;
		loading?: boolean;
		error?: string | null;
		class_?: string;
	}>();
</script>

<div class="chart-card {class_}">
	{#if title}
		<h3 class="chart-title">{title}</h3>
	{/if}

	{#if loading}
		<!-- render nothing while loading -->
	{:else if error}
		<div class="chart-error" role="alert">{error}</div>
	{:else}
		<slot />
	{/if}
</div>

<style>
	.chart-card {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 20px;
		background: var(--bg);
	}

	.chart-title {
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--dim);
		margin: 0 0 16px 0;
	}

	.chart-error {
		font-size: 12px;
		color: var(--red);
		padding: 8px 0;
	}
</style>
