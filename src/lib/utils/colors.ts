// Color palette constants for charts and UI components
// Ensures consistency across all Recharts visualizations and Svelte components

export type Theme = 'dark' | 'light';

export const CHART_COLORS = {
	primary: '#7c3aed', // violet-600
	secondary: '#0ea5e9', // sky-500
	success: '#10b981', // emerald-500
	warning: '#f59e0b', // amber-500
	danger: '#ef4444', // red-500
	info: '#6366f1', // indigo-500
	purple: '#a855f7', // purple-500
	teal: '#14b8a6', // teal-500
	orange: '#f97316', // orange-500
	pink: '#ec4899' // pink-500
} as const;

export const DARK_THEME = {
	background: '#030712', // gray-950
	cardBackground: '#111827', // gray-900
	border: '#1f2937', // gray-800
	gridLine: '#1f2937', // gray-800
	text: '#f3f4f6', // gray-100
	textSecondary: '#9ca3af', // gray-400
	textMuted: '#4b5563', // gray-600
	tooltipBackground: '#1f2937', // gray-800
	tooltipBorder: '#374151' // gray-700
} as const;

export const LIGHT_THEME = {
	background: '#f9fafb', // gray-50
	cardBackground: '#ffffff', // white
	border: '#e5e7eb', // gray-200
	gridLine: '#e5e7eb', // gray-200
	text: '#111827', // gray-900
	textSecondary: '#6b7280', // gray-500
	textMuted: '#9ca3af', // gray-400
	tooltipBackground: '#ffffff', // white
	tooltipBorder: '#e5e7eb' // gray-200
} as const;

// Chart color sequences for multi-series charts
export const SERIES_COLORS_DARK = [
	CHART_COLORS.primary,
	CHART_COLORS.secondary,
	CHART_COLORS.success,
	CHART_COLORS.warning,
	CHART_COLORS.info,
	CHART_COLORS.teal,
	CHART_COLORS.orange,
	CHART_COLORS.pink
];

export const SERIES_COLORS_LIGHT = [
	'#6d28d9', // violet-700
	'#0369a1', // sky-700
	'#047857', // emerald-700
	'#b45309', // amber-700
	'#4338ca', // indigo-700
	'#0f766e', // teal-700
	'#c2410c', // orange-700
	'#be185d' // pink-700
];

/**
 * Get theme-appropriate colors for Recharts components
 */
export function getThemeColors(theme: Theme) {
	return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

/**
 * Get a series color by index, cycling through the palette
 */
export function getSeriesColor(index: number, theme: Theme = 'dark'): string {
	const colors = theme === 'dark' ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT;
	return colors[index % colors.length];
}

/**
 * Get all series colors for the given theme
 */
export function getSeriesColors(theme: Theme = 'dark'): string[] {
	return theme === 'dark' ? [...SERIES_COLORS_DARK] : [...SERIES_COLORS_LIGHT];
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
	if (percentage >= 70) return CHART_COLORS.success;
	if (percentage >= 40) return CHART_COLORS.warning;
	return CHART_COLORS.danger;
}

// Model-name to color mapping — indexed by any string model identifier
export const MODEL_COLORS: Record<string, string> = {
	'claude-3-5-sonnet': CHART_COLORS.primary,
	'claude-3-5-haiku': CHART_COLORS.purple,
	'claude-3-opus': CHART_COLORS.info,
	'gpt-4o': CHART_COLORS.secondary,
	'gpt-4o-mini': CHART_COLORS.teal,
	'gpt-4-turbo': CHART_COLORS.warning,
	'gpt-3.5-turbo': CHART_COLORS.orange,
	'gemini-1.5-pro': CHART_COLORS.success,
	'gemini-1.5-flash': CHART_COLORS.pink,
	default: CHART_COLORS.danger
};

// Sequential color palette for multi-series charts
export const CHART_PALETTE: string[] = [...SERIES_COLORS_DARK];
