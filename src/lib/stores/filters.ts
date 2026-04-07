// Global filter store — shared across all pages
// Defaults to last 30 days

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

const SUB_DAY_PRESETS: TimePreset[] = ['15m', '1h', '4h', '12h', '24h'];

export function isSubDayPreset(preset: TimePreset): boolean {
	return SUB_DAY_PRESETS.includes(preset);
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

function makeDefault(): FilterState {
	const { from, to } = presetToDates('30d');
	return {
		from,
		to,
		preset: '30d',
		project: null,
		agent: null,
		provider: null,
		model: null,
		apiKey: null
	};
}

function createFiltersStore() {
	const { subscribe, set, update } = writable<FilterState>(makeDefault());

	return {
		subscribe,
		set,
		update,
		reset() {
			set(makeDefault());
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
export const filterParams = derived(filters, ($f) => {
	const p = new URLSearchParams();
	// Use full ISO timestamps for sub-day presets to preserve hour precision
	if (isSubDayPreset($f.preset)) {
		p.set('from', $f.from.toISOString());
		p.set('to', $f.to.toISOString());
	} else {
		p.set('from', formatDate($f.from));
		p.set('to', formatDate($f.to));
	}
	if ($f.project) p.set('project', $f.project);
	if ($f.agent) p.set('agent', $f.agent);
	if ($f.provider) p.set('provider', $f.provider);
	if ($f.model) p.set('model', $f.model);
	if ($f.apiKey) p.set('apiKey', $f.apiKey);
	return p.toString();
});
