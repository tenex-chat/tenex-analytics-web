// Telemetry store: manages dashboard data state with loading/error handling
import { writable, derived } from 'svelte/store';
import type { TelemetrySummary, TokenUsageTrend, CacheMetrics, DateRangeParams } from '$lib/api/types.js';
import { getTelemetrySummary, getTokenTrends, getCacheMetrics } from '$lib/api/client.js';

export interface TelemetryState {
	summary: TelemetrySummary | null;
	tokenTrends: TokenUsageTrend | null;
	cacheMetrics: CacheMetrics | null;
	loading: boolean;
	error: string | null;
	lastFetched: number | null;
}

const initialState: TelemetryState = {
	summary: null,
	tokenTrends: null,
	cacheMetrics: null,
	loading: false,
	error: null,
	lastFetched: null
};

function createTelemetryStore() {
	const { subscribe, set, update } = writable<TelemetryState>(initialState);

	async function fetchAll(range?: DateRangeParams) {
		update((s) => ({ ...s, loading: true, error: null }));
		try {
			const [summary, tokenTrends, cacheMetrics] = await Promise.all([
				getTelemetrySummary(range),
				getTokenTrends(range),
				getCacheMetrics(range)
			]);
			update((s) => ({
				...s,
				summary,
				tokenTrends,
				cacheMetrics,
				loading: false,
				lastFetched: Date.now()
			}));
		} catch (err) {
			update((s) => ({
				...s,
				loading: false,
				error: err instanceof Error ? err.message : 'Failed to fetch telemetry data'
			}));
		}
	}

	function reset() {
		set(initialState);
	}

	return { subscribe, fetchAll, reset };
}

export const telemetry = createTelemetryStore();

// Derived: is data stale? (older than 60 seconds)
export const isStale = derived(telemetry, ($t) => {
	if (!$t.lastFetched) return true;
	return Date.now() - $t.lastFetched > 60_000;
});
