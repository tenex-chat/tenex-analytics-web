# Svelte 5 Quick Reference — Developer Cheat Sheet

**Never used Svelte 5?** Start here. Bookmark this.

---

## 🔄 State Management

### ❌ Svelte 4 (Old)

```svelte
<script>
	let count = 0;
	let { name } = $$props; // Props
</script>
```

### ✅ Svelte 5 (New)

```svelte
<script>
	let count = $state(0);
	let { name } = $props();
</script>
```

**Key Point:** Always use runes. `$state()` makes variables reactive.

---

## 💾 State Destructuring (CAREFUL!)

### ❌ This BREAKS reactivity

```svelte
<script>
	let state = $state({ count: 0, name: 'Alice' });
	let { count, name } = state; // ❌ Breaking destructuring!

	count++; // This won't work — count is not reactive anymore
</script>
```

### ✅ Do this instead

```svelte
<script>
	let state = $state({ count: 0, name: 'Alice' });
	// Access properties directly:
</script>

<button onclick={() => state.count++}>
	Count: {state.count}
</button>
```

**Or use `$state.snapshot()`:**

```svelte
<script>
	let state = $state({ count: 0, name: 'Alice' });
	let snapshot = $state.snapshot(state); // Safe for destructuring
</script>
```

---

## 📊 Computed Values

### ❌ Svelte 4

```svelte
<script>
	let count = 0;
	$: doubled = count * 2;
</script>
```

### ✅ Svelte 5

```svelte
<script>
	let count = $state(0);
	let doubled = $derived(count * 2); // Read-only computed value
</script>
```

**Key Points:**

- `$derived` is automatic memoization (runs when dependencies change)
- Must be a pure function (no side effects)
- Read-only (can't assign to it)

---

## 🎯 Effects & Side Effects

### ❌ Svelte 4

```svelte
<script>
	import { onMount } from 'svelte';

	onMount(() => {
		console.log('Component mounted');
		return () => console.log('Cleanup');
	});
</script>
```

### ✅ Svelte 5

```svelte
<script>
	$effect(() => {
		console.log('Setup code runs');

		// Cleanup function (optional)
		return () => {
			console.log('Cleanup runs');
		};
	});
</script>
```

**Key Points:**

- `$effect` runs when dependencies change
- Returns cleanup function (like `onMount` return)
- Automatically tracks reactive values it reads
- No async directly in effect body

---

## 🔗 Two-Way Binding

### Only if needed:

```svelte
<script>
	let name = $state('Alice');
</script>

<!-- Two-way bind: changes in input update 'name' -->
<input bind:value={name} />
<p>Hello {name}</p>

<!-- But prefer one-way data flow when possible -->
<input value={name} onchange={(e) => (name = e.target.value)} />
```

Use `bind:` sparingly. One-way data flow is usually better.

---

## 🎪 Events & Event Handlers

### ❌ Svelte 4

```svelte
<button on:click={() => alert('Hello')}>Click me</button>
```

### ✅ Svelte 5

```svelte
<button onclick={() => alert('Hello')}>Click me</button>
```

**All Svelte 5 event handlers:**

- `onclick` (instead of `on:click`)
- `onchange` (instead of `on:change`)
- `onmouseenter` (instead of `on:mouseenter`)
- `onkeydown` (instead of `on:keydown`)
- `onsubmit` (instead of `on:submit`)
- etc.

**Pattern:** `on:X` → `onX`

---

## 📝 Component Props

### ❌ Svelte 4

```svelte
<script>
	export let name;
	export let age = 18;
</script>
```

### ✅ Svelte 5

```svelte
<script>
	let { name, age = 18 } = $props();
</script>
```

**With TypeScript:**

```svelte
<script lang="ts">
	interface Props {
		name: string;
		age?: number;
	}

	let { name, age = 18 }: Props = $props();
</script>
```

---

## 🔄 Two-Way Prop Binding

```svelte
<script>
	let count = $state(0);
</script>

<!-- Child component -->
<Counter bind:value={count} />
```

**Child Component:**

```svelte
<script>
	let { value = $bindable() } = $props();
</script>

<button onclick={() => value++}>
	Count: {value}
</button>
```

---

## 🎯 Snippets (Composition)

### ❌ Svelte 4 Slots

```svelte
<!-- Parent -->
<Card>
	<h2>Title</h2>
	<p>Content</p>
</Card>

<!-- Card.svelte -->
<div>
	<slot />
	<!-- renders children -->
</div>
```

### ✅ Svelte 5 Snippets

```svelte
<!-- Card.svelte -->
<script>
	let { content } = $props();
</script>

<!-- Parent -->
<Card>
	{#snippet content()}
		<h2>Title</h2>
		<p>Content</p>
	{/snippet}
</Card>

<div>
	{@render content()}
</div>
```

**Snippet with parameters:**

```svelte
{#snippet buttonContent(label, color)}
	<button style="background: {color}">{label}</button>
{/snippet}

{@render buttonContent('Click me', 'blue')}
```

---

## 🛡️ Debugging

```svelte
<script>
	let name = $state('Alice');

	// Shows value in DevTools whenever it changes
	$inspect(name);

	// Show on changes
	$inspect.trace(name); // logs when it changes
</script>
```

Tree-shaken in production. Safe to leave in code.

---

## 🎨 Styling

```svelte
<script>
	let isDark = $state(false);
</script>

<div class:dark={isDark}>
	<button onclick={() => (isDark = !isDark)}> Toggle dark mode </button>
</div>

<style>
	div {
		background: white;
		color: black;
	}

	div.dark {
		background: black;
		color: white;
	}
</style>
```

---

## 🚫 Common Mistakes

| ❌ Wrong                  | ✅ Right                           | Why                             |
| ------------------------- | ---------------------------------- | ------------------------------- |
| `let { x } = $state(...)` | `let state = $state(...); state.x` | Destructuring breaks reactivity |
| Async in effect body      | Call async function from effect    | Async not tracked automatically |
| Missing effect cleanup    | Return cleanup function            | Memory leaks                    |
| `on:click`                | `onclick`                          | Svelte 5 syntax                 |
| `export let x`            | `let { x } = $props()`             | Svelte 5 syntax                 |
| `$: x = y`                | `let x = $derived(y)`              | Svelte 5 syntax                 |
| `onMount(() => {...})`    | `$effect(() => {...})`             | Svelte 5 syntax                 |

---

## 📚 Resources

| Resource             | Link                                              |
| -------------------- | ------------------------------------------------- |
| Svelte 5 Docs        | https://svelte.dev/docs                           |
| Runes API            | https://svelte.dev/docs/svelte/runes-api          |
| Migration Guide      | https://svelte.dev/docs/svelte/v5-migration-guide |
| Interactive Examples | https://svelte.dev/playground                     |
| Svelte Discord       | https://discord.gg/svelte                         |

---

**Tip:** When in doubt, check if your code:

1. Uses `$state`, `$derived`, `$effect`, `$props`
2. Doesn't destructure `$state` objects
3. Uses `onclick` not `on:click`
4. Has cleanup functions in effects
5. Has proper TypeScript types

You're golden! 🎉
