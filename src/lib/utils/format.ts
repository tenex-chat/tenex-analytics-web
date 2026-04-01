// Formatting utility functions for dashboard display
// Numbers, currency, dates, tokens, percentages

/**
 * Format a token count with appropriate suffix (K, M, B)
 * e.g., 10500000 → "10.5M"
 */
export function formatTokens(count: number): string {
	if (count >= 1_000_000_000) {
		return `${(count / 1_000_000_000).toFixed(1)}B`;
	}
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(1)}M`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(1)}K`;
	}
	return count.toString();
}

/**
 * Format a number with locale-aware comma separators
 * e.g., 1234567 → "1,234,567"
 */
export function formatNumber(value: number, decimals = 0): string {
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

/**
 * Format a cost value as USD currency
 * e.g., 12.345 → "$12.35"
 */
export function formatCost(value: number, decimals = 2): string {
	if (value < 0.01 && value > 0) {
		return `<$0.01`;
	}
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

/**
 * Format a percentage value
 * e.g., 0.734 → "73.4%" or 73.4 → "73.4%"
 */
export function formatPercent(value: number, decimals = 1): string {
	// Accept either 0-1 or 0-100 range
	const pct = value > 1 ? value : value * 100;
	return `${pct.toFixed(decimals)}%`;
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 */
export function formatDate(date: Date | string | number): string {
	const d = new Date(date);
	return d.toISOString().split('T')[0];
}

/**
 * Format a date for display (e.g., "Mar 15, 2024")
 */
export function formatDateDisplay(date: Date | string | number): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(new Date(date));
}

/**
 * Format a datetime for display (e.g., "Mar 15, 2024 14:32")
 */
export function formatDateTimeDisplay(date: Date | string | number): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(date));
}

/**
 * Format a relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
	const diff = Date.now() - new Date(date).getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return 'just now';
}

/**
 * Format a duration in milliseconds to human-readable form
 * e.g., 123456 → "2m 3s"
 */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Format cost per thousand tokens (CPT)
 * e.g., 0.00002 → "$0.02 / 1K"
 */
export function formatCostPerToken(costPerToken: number): string {
	const costPer1K = costPerToken * 1000;
	return `${formatCost(costPer1K)} / 1K`;
}

/**
 * Format a token delta with sign prefix
 * e.g., 500 → "+500", -200 → "-200"
 */
export function formatTokenDelta(delta: number): string {
	const formatted = formatTokens(Math.abs(delta));
	return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}
