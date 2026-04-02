<script lang="ts">
	import { Bar } from 'svelte-chartjs';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		BarElement,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';
	import { SERIES_COLORS, hexToRgba, getChartTheme } from '$lib/utils/colors.js';

	ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

	export let data: Array<Record<string, number | string>> = [];
	export let bars: Array<{ key: string; label: string; color?: string }> = [];
	export let xKey: string;
	export let height: number = 300;
	export let title: string | undefined = undefined;
	export let horizontal: boolean = false;
	export let stacked: boolean = false;

	$: theme = getChartTheme();

	$: chartData = {
		labels: data.map((d) => d[xKey] as string),
		datasets: bars.map((bar, i) => {
			const color = bar.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
			return {
				label: bar.label,
				data: data.map((d) => Number(d[bar.key]) || 0),
				backgroundColor: hexToRgba(color, 0.8),
				borderColor: color,
				borderWidth: 1,
				borderRadius: stacked ? 0 : 3,
				stack: stacked ? 'stack' : undefined
			};
		})
	};

	$: options = {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: (horizontal ? 'y' : 'x') as 'x' | 'y',
		interaction: {
			mode: 'index' as const,
			intersect: false
		},
		plugins: {
			legend: {
				display: bars.length > 1,
				labels: {
					color: theme.textColor,
					font: { size: 12 }
				}
			},
			title: {
				display: !!title,
				text: title ?? '',
				color: theme.tooltipText,
				font: { size: 14 }
			},
			tooltip: {
				backgroundColor: theme.tooltipBackground,
				borderColor: theme.tooltipBorder,
				borderWidth: 1,
				titleColor: theme.tooltipText,
				bodyColor: theme.textColor
			}
		},
		scales: {
			x: {
				stacked: stacked,
				ticks: { color: theme.textColor, font: { size: 11 }, maxRotation: 45 },
				grid: { color: theme.gridColor }
			},
			y: {
				stacked: stacked,
				ticks: { color: theme.textColor, font: { size: 11 } },
				grid: { color: theme.gridColor }
			}
		}
	};
</script>

{#if data.length === 0}
	<div class="empty-state" style="height: {height}px">
		<p class="empty-text">No data available</p>
	</div>
{:else}
	<div style="height: {height}px; position: relative;">
		<Bar data={chartData} {options} />
	</div>
{/if}

<style>
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		border-radius: var(--radius);
		border: 1px dashed var(--border);
	}

	.empty-text {
		color: var(--muted);
		font-size: 0.875rem;
	}
</style>
