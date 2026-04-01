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
	export let annotations: Array<{ index: number; color: string; label: string }> = [];
	/** When true, renders as a stacked area chart */
	export let stacked: boolean = false;

	$: theme = getChartTheme();

	$: chartData = {
		labels: data.map((d) => d[xKey] as string),
		datasets: lines.map((line, i) => {
			const color = line.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
			return {
				label: line.label,
				data: data.map((d) => Number(d[line.key]) || 0),
				borderColor: color,
				backgroundColor: stacked ? hexToRgba(color, 0.75) : hexToRgba(color, 0.1),
				borderWidth: stacked ? 0 : 2,
				pointRadius: data.length > 30 ? 0 : (stacked ? 0 : 3),
				pointHoverRadius: stacked ? 0 : 5,
				tension: 0.3,
				fill: stacked ? 'stack' : false
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
				stacked: stacked ? true : undefined,
				ticks: { color: theme.textColor, font: { size: 11 } },
				grid: { color: theme.gridColor }
			}
		}
	};

	// Deduplicate annotation labels for the legend
	$: annotationLegend = annotations.reduce<Array<{ color: string; label: string }>>(
		(acc, a) => {
			if (!acc.some((x) => x.label === a.label)) acc.push({ color: a.color, label: a.label });
			return acc;
		},
		[]
	);

	// Group annotations by index so multiple events at the same point stack
	$: annotationsByIndex = annotations.reduce<Map<number, Array<{ color: string; label: string }>>>(
		(map, a) => {
			const list = map.get(a.index) ?? [];
			list.push({ color: a.color, label: a.label });
			map.set(a.index, list);
			return map;
		},
		new Map()
	);

	$: totalPoints = data.length;
</script>

{#if data.length === 0}
	<div class="empty-state" style="height: {height}px">
		<p class="empty-text">No data available</p>
	</div>
{:else}
	<div class="chart-wrapper">
		<div style="height: {height}px; position: relative;">
			<Line data={chartData} {options} />
		</div>

		{#if annotations.length > 0}
			<!-- Annotation dot strip — one slot per data point, dots at event positions -->
			<div class="annotation-strip" style="--total: {totalPoints}">
				{#each { length: totalPoints } as _, i}
					<div class="annotation-slot">
						{#if annotationsByIndex.has(i)}
							{#each annotationsByIndex.get(i) ?? [] as ann}
								<span
									class="annotation-dot"
									style="background: {ann.color};"
									title="{ann.label} at #{i + 1}"
								></span>
							{/each}
						{/if}
					</div>
				{/each}
			</div>

			<!-- Legend -->
			<div class="annotation-legend">
				{#each annotationLegend as item}
					<span class="legend-item">
						<span class="legend-dot" style="background: {item.color};"></span>
						<span class="legend-label">{item.label}</span>
					</span>
				{/each}
			</div>
		{/if}
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

	.chart-wrapper {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.annotation-strip {
		display: flex;
		width: 100%;
		height: 12px;
		/* Align slots evenly across the full width */
		padding: 0 1px;
		box-sizing: border-box;
	}

	.annotation-slot {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
	}

	.annotation-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.annotation-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		padding-top: 2px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.legend-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-label {
		font-size: 11px;
		color: var(--muted);
	}
</style>
