# fold.js

**Make any web app foldable-ready.** Hinge-aware layouts for foldable phones — in React, Vue, Svelte, Solid, Angular… or plain HTML.

- 🪟 **Two-pane layouts** that put each pane on its own side of the hinge
- 📐 **Posture detection**: `flat`, `book`, `tabletop`, `folded`
- 🧪 **Built-in foldable simulator** — no device, no DevTools setup
- 🧩 **Works everywhere**: framework-agnostic core, thin adapters, Web Components, CSS-only layer
- 🪶 **~2 kB** min+gzip core, zero dependencies, SSR-safe, TypeScript

Built on the web standards shipping in Chromium: [CSS Viewport Segments](https://developer.mozilla.org/en-US/docs/Web/API/Viewport_segments_API) and the [Device Posture API](https://developer.mozilla.org/en-US/docs/Web/API/Device_Posture_API).

---

## Install

```bash
npm i foldjs            # core, CSS, Web Components, simulator
npm i @foldjs/react     # or @foldjs/vue, @foldjs/svelte, @foldjs/solid
```

## React

```tsx
import { TwoPane, FoldWhen, FoldDevtools, useFold } from "@foldjs/react";

export function Inbox() {
  const { posture, hinge } = useFold();

  return (
    <>
      <TwoPane
        primary={<MailList />}
        secondary={<MailDetail />}
        fallback="stack" // single screen: "stack" | "primary" | "secondary"
      />
      <FoldWhen posture="tabletop">
        <PlayerControls />
      </FoldWhen>
      {import.meta.env.DEV && <FoldDevtools initial="book" />}
    </>
  );
}
```

## Vue

```vue
<script setup>
import { TwoPane, FoldWhen, useFold } from "@foldjs/vue";
const fold = useFold(); // fold.value.posture
</script>

<template>
  <TwoPane fallback="stack">
    <template #primary><MailList /></template>
    <template #secondary><MailDetail /></template>
  </TwoPane>
</template>
```

## Svelte

```svelte
<script>
  import { fold, twoPane, foldWhen } from "@foldjs/svelte";
</script>

<div use:twoPane={{ fallback: "stack" }}>
  <div data-pane="primary"><MailList /></div>
  <div data-pane="secondary"><MailDetail /></div>
</div>

<p>Posture: {$fold.posture}</p>
<div use:foldWhen={"tabletop"}>Tabletop only</div>
```

## Solid

```tsx
import { createFold, twoPane } from "@foldjs/solid";

const fold = createFold(); // fold().posture

<div use:twoPane={{ fallback: "stack" }}>
  <div data-pane="primary"><MailList /></div>
  <div data-pane="secondary"><MailDetail /></div>
</div>
```

## Web Components (Angular, Lit, Astro, htmx, plain HTML…)

```html
<script type="module">import "foldjs/elements";</script>

<fold-two-pane fallback="stack">
  <div slot="primary">List</div>
  <div slot="secondary">Detail</div>
</fold-two-pane>

<fold-when posture="tabletop book">Only on a split screen</fold-when>
```

## CSS only

```js
import "foldjs/css";
import { init } from "foldjs";
init(); // optional: enables the simulator and non-native browsers
```

```html
<div class="fold-two-pane">
  <div class="fold-primary">List</div>
  <div class="fold-secondary">Detail</div>
</div>
<div class="fold-only-tabletop">Tabletop only</div>
```

Variables available on `<html>`: `--fold-hinge-x|y|width|height`, `--fold-segment-0-width|height`, `--fold-segment-1-width|height`.
Attributes: `data-fold-posture`, `data-fold-spanning`.

## The simulator

```js
import { mountDevtools } from "foldjs/devtools";
mountDevtools({ initial: "book", position: "bottom-right", hingeSize: 24 });
```

Switch between **Device / Flat / Book / Tabletop** from the floating panel, or press **Alt + Shift + F**.
Or drive it from code (tests, demos, Storybook): `simulate({ posture: "tabletop" })`, `simulate(null)`.

## Core API

```ts
import { getFold, subscribe, simulate, twoPaneLayout, bindTwoPane } from "foldjs";

getFold();
// {
//   posture: "book",                 // "flat" | "book" | "tabletop" | "folded"
//   spanning: "columns",             // "none" | "columns" | "rows"
//   isSpanned: true,
//   segments: [{ x, y, width, height }, …],
//   hinge: { x, y, width, height },
//   devicePosture: "folded",         // raw Device Posture API value
//   viewport: { width, height },
//   simulated: false
// }

const off = subscribe((state) => console.log(state.posture));
```

Writing an adapter for another framework? `subscribe` + `getFold` are all you need; `twoPaneLayout(state)` returns the styles every built-in adapter uses.

## Browser support

| | Native | With `foldjs` |
|---|---|---|
| Chrome / Edge on Android foldables | ✅ Viewport Segments + Device Posture | ✅ |
| Samsung Internet, other browsers | — | ✅ Single-screen fallback, simulator |
| Desktop | — | ✅ Simulator |

## Repository

```
packages/core     foldjs           core, CSS, Web Components, simulator
packages/react    @foldjs/react
packages/vue      @foldjs/vue
packages/svelte   @foldjs/svelte
packages/solid    @foldjs/solid
apps/demo         demo site (Vite + React)
```

```bash
npm install
npm run dev        # demo on http://localhost:5173
npm test
npm run build
```

## License

MIT
