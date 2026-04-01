// Theme store: manages dark/light mode with localStorage persistence
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';

function createThemeStore() {
	const initial: Theme =
		browser
			? ((localStorage.getItem('theme') as Theme) ??
					(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
			: 'dark';

	const { subscribe, set, update } = writable<Theme>(initial);

	function applyTheme(theme: Theme) {
		if (!browser) return;
		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
			root.classList.remove('light');
		} else {
			root.classList.add('light');
			root.classList.remove('dark');
		}
		localStorage.setItem('theme', theme);
	}

	// Apply on init
	if (browser) applyTheme(initial);

	return {
		subscribe,
		toggle() {
			update((current) => {
				const next: Theme = current === 'dark' ? 'light' : 'dark';
				applyTheme(next);
				return next;
			});
		},
		set(theme: Theme) {
			applyTheme(theme);
			set(theme);
		}
	};
}

export const theme = createThemeStore();
