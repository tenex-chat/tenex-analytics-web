// Global filter store — shared across all pages
// Defaults to last 30 days

import { writable, derived } from 'svelte/store';
import { formatDate } from '$lib/utils/format.js';

export interface FilterState {
	from: Date;
	to: Date;
	project: string | null;
	agent: string | null;
	provider: string | null;
	model: string | null;
}

function makeDefault(): FilterState {
	const to = new Date();
	const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
	return { from, to, project: null, agent: null, provider: null, model: null };
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
			update((s) => ({ ...s, from, to }));
		}
	};
}

export const filters = createFiltersStore();

/** Derive URL search params string from current filter state */
export const filterParams = derived(filters, ($f) => {
	const p = new URLSearchParams();
	p.set('from', formatDate($f.from));
	p.set('to', formatDate($f.to));
	if ($f.project) p.set('project', $f.project);
	if ($f.agent) p.set('agent', $f.agent);
	if ($f.provider) p.set('provider', $f.provider);
	if ($f.model) p.set('model', $f.model);
	return p.toString();
});
