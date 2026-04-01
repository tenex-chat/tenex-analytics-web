export const CHART_COLORS = {
	primary: '#a1a1aa',    // zinc-400
	secondary: '#71717a',  // zinc-500
	tertiary: '#52525b',   // zinc-600
	quaternary: '#3f3f46', // zinc-700
	green: '#22c55e',
	red: '#ef4444',
	yellow: '#eab308',
};

export const SERIES_COLORS = [
	'#a1a1aa', // zinc-400
	'#22c55e', // green
	'#eab308', // yellow
	'#f97316', // orange
	'#ef4444', // red
	'#71717a', // zinc-500
];

export function getChartTheme() {
	return {
		backgroundColor: 'transparent',
		textColor: '#a1a1aa',
		gridColor: '#27272a',
		tooltipBackground: '#18181b',
		tooltipBorder: '#27272a',
		tooltipText: '#fafafa',
	};
}

/**
 * Convert a hex color to rgba with given opacity
 */
export function hexToRgba(hex: string, alpha: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get cache efficiency color based on percentage
 */
export function getCacheEfficiencyColor(percentage: number): string {
	if (percentage >= 70) return CHART_COLORS.green;
	if (percentage >= 40) return CHART_COLORS.yellow;
	return CHART_COLORS.red;
}
