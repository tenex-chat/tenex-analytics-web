<script lang="ts">
	import { Line } from 'svelte-chartjs';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Title,
		Tooltip,
		Legend,
		Filler
	} from 'chart.js';
	import { SERIES_COLORS, hexToRgba, getChartTheme } from '$lib/utils/colors.js';

	ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

	export let data: Array<Record<string, number | string>> = [];
	export let lines: Array<{ key: string; label: string; color?: string }> = [];
	export let xKey: string;
	export let height: number = 300;
	export let title: string | undefined = undefined;

	$: theme = getChartTheme();

	$: chartData = {
		labels: data.map((d) => d[xKey] as string),
		datasets: lines.map((line, i) => {
			const color = line.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
			return {
				label: line.label,
				data: data.map((d) => Number(d[line.key]) || 0),
				borderColor: color,
				backgroundColor: hexToRgba(color, 0.1),
				borderWidth: 2,
				pointRadius: data.length > 30 ? 0 : 3,
				pointHoverRadius: 5,
				tension: 0.3,
				fill: false
			};
		})
	};

	$: options = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: 'index' as const,
			intersect: false
		},
		plugins: {
			legend: {
				display: lines.length > 1,
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
				ticks: { color: theme.textColor, font: { size: 11 }, maxTicksLimit: 12 },
				grid: { color: theme.gridColor }
			},
			y: {
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
		<Line data={chartData} {options} />
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
