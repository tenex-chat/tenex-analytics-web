// Global filter store — shared across all pages
// Defaults to last 15 minutes

import { writable, derived } from 'svelte/store';
import { formatDate } from '$lib/utils/format.js';

export type TimePreset = '15m' | '1h' | '4h' | '12h' | '24h' | '7d' | '30d' | 'custom';

export interface FilterState {
	from: Date;
	to: Date;
	preset: TimePreset;
	project: string | null;
	agent: string | null;
	provider: string | null;
	model: string | null;
	apiKey: string | null;
}

const TIME_PRESETS: TimePreset[] = ['15m', '1h', '4h', '12h', '24h', '7d', '30d', 'custom'];
const SUB_DAY_PRESETS: TimePreset[] = ['15m', '1h', '4h', '12h', '24h'];
export const FILTER_QUERY_KEYS = [
	'preset',
	'from',
	'to',
	'project',
	'agent',
	'provider',
	'model',
	'apiKey'
] as const;
export const DEFAULT_PRESET: Exclude<TimePreset, 'custom'> = '15m';

export function isSubDayPreset(preset: TimePreset): boolean {
	return SUB_DAY_PRESETS.includes(preset);
}

export function isTimePreset(value: string | null | undefined): value is TimePreset {
	return value !== null && value !== undefined && TIME_PRESETS.includes(value as TimePreset);
}

const PRESET_MS: Record<Exclude<TimePreset, 'custom'>, number> = {
	'15m': 15 * 60 * 1000,
	'1h': 60 * 60 * 1000,
	'4h': 4 * 60 * 60 * 1000,
	'12h': 12 * 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

/** Compute from/to Dates for a given preset */
export function presetToDates(preset: Exclude<TimePreset, 'custom'>): { from: Date; to: Date } {
	const to = new Date();
	const from = new Date(to.getTime() - PRESET_MS[preset]);
	return { from, to };
}

export function createDefaultFilters(): FilterState {
	const { from, to } = presetToDates(DEFAULT_PRESET);
	return {
		from,
		to,
		preset: DEFAULT_PRESET,
		project: null,
		agent: null,
		provider: null,
		model: null,
		apiKey: null
	};
}

function normalizeFilterValue(value: string | null): string | null {
	return value ? value : null;
}

function isValidDate(date: Date): boolean {
	return !Number.isNaN(date.getTime());
}

export function hasFilterQueryParams(searchParams: URLSearchParams): boolean {
	return FILTER_QUERY_KEYS.some((key) => searchParams.has(key));
}

export function buildFilterSearchParams(state: FilterState): URLSearchParams {
	const params = new URLSearchParams();
	params.set('preset', state.preset);
	if (isSubDayPreset(state.preset)) {
		params.set('from', state.from.toISOString());
		params.set('to', state.to.toISOString());
	} else {
		params.set('from', formatDate(state.from));
		params.set('to', formatDate(state.to));
	}
	if (state.project) params.set('project', state.project);
	if (state.agent) params.set('agent', state.agent);
	if (state.provider) params.set('provider', state.provider);
	if (state.model) params.set('model', state.model);
	if (state.apiKey) params.set('apiKey', state.apiKey);
	return params;
}

export function serializeFilterState(state: FilterState): string {
	return buildFilterSearchParams(state).toString();
}

export function parseFiltersFromSearchParams(
	searchParams: URLSearchParams,
	fallback: FilterState = createDefaultFilters()
): FilterState {
	const presetParam = searchParams.get('preset');
	const fromParam = searchParams.get('from');
	const toParam = searchParams.get('to');

	let from = fallback.from;
	let to = fallback.to;
	let preset: TimePreset = fallback.preset;

	if (fromParam && toParam) {
		const nextFrom = new Date(fromParam);
		const nextTo = new Date(toParam);
		if (isValidDate(nextFrom) && isValidDate(nextTo) && nextFrom.getTime() <= nextTo.getTime()) {
			from = nextFrom;
			to = nextTo;
			preset = isTimePreset(presetParam) ? presetParam : 'custom';
		}
	} else if (isTimePreset(presetParam) && presetParam !== 'custom') {
		const range = presetToDates(presetParam);
		from = range.from;
		to = range.to;
		preset = presetParam;
	}

	return {
		...fallback,
		from,
		to,
		preset,
		project: normalizeFilterValue(searchParams.get('project')),
		agent: normalizeFilterValue(searchParams.get('agent')),
		provider: normalizeFilterValue(searchParams.get('provider')),
		model: normalizeFilterValue(searchParams.get('model')),
		apiKey: normalizeFilterValue(searchParams.get('apiKey'))
	};
}

function createFiltersStore() {
	const { subscribe, set, update } = writable<FilterState>(createDefaultFilters());

	return {
		subscribe,
		set,
		update,
		reset() {
			set(createDefaultFilters());
		},
		setDateRange(from: Date, to: Date) {
			update((s) => ({ ...s, from, to, preset: 'custom' }));
		},
		setPreset(preset: TimePreset) {
			if (preset === 'custom') {
				update((s) => ({ ...s, preset: 'custom' }));
			} else {
				const { from, to } = presetToDates(preset);
				update((s) => ({ ...s, from, to, preset }));
			}
		}
	};
}

export const filters = createFiltersStore();

/** Derive URL search params string from current filter state */
export const filterParams = derived(filters, ($f) => buildFilterSearchParams($f).toString());
