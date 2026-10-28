# fold.js: foldable phone support for React, Vue, Svelte and the web

[![npm](https://img.shields.io/npm/v/foldjs?color=5b4bff)](https://www.npmjs.com/package/foldjs)
[![gzip size](https://img.shields.io/bundlejs/size/foldjs?label=gzip)](https://bundlejs.com/?q=foldjs)
[![license](https://img.shields.io/npm/l/foldjs)](LICENSE)
[![demo](https://img.shields.io/badge/demo-live-5b4bff)](https://christophe77.github.io/foldjs/)

**fold.js is an open-source JavaScript library that makes web apps work properly on foldable phones** such as the Samsung Galaxy Z Fold, Google Pixel Fold, Honor Magic V or Microsoft Surface Duo. It detects the hinge and the device posture (flat, book, tabletop), and gives you two-pane layouts that never put content under the hinge. It works with React, Vue, Svelte, Solid, Angular, Astro or plain HTML, weighs about 2 kB, and ships with a built-in foldable simulator so you can build without owning a device.

### [▶ Try the live demo](https://christophe77.github.io/foldjs/) (works on desktop: the simulator is built in)

![fold.js demo switching a web app between flat, book and tabletop postures on a simulated foldable phone](https://raw.githubusercontent.com/christophe77/foldjs/main/docs/demo.gif)

## Why fold.js?

Most web apps treat a foldable phone as one big rectangle. Once the device is folded or spanned, text and buttons land under the hinge, and the half-folded "tabletop" posture is ignored. Chromium now exposes the right web standards ([CSS Viewport Segments](https://developer.mozilla.org/en-US/docs/Web/API/Viewport_segments_API) and the [Device Posture API](https://developer.mozilla.org/en-US/docs/Web/API/Device_Posture_API)), but using them directly means pixel math, event wiring, SSR guards and no way to test without hardware. Microsoft's earlier dual-screen libraries (`react-foldable`, `react-native-dualscreen`) are archived.

fold.js wraps all of that in one small, framework-agnostic API.

## Features

- 🪟 **Two-pane layouts**: each pane on its own side of the hinge, stacked (or one hidden) on regular phones
- 📐 **Posture detection**: `flat`, `book` (vertical hinge), `tabletop` (horizontal hinge), `folded`
- 📏 **Hinge geometry**: exact position and size of the hinge and of each screen segment, in JS and as CSS variables
- 🧪 **Built-in foldable simulator**: switch postures from a floating panel or with Alt+Shift+F, on any desktop browser
- 🧩 **Every framework**: React, Vue, Svelte, Solid adapters, Web Components for everything else, and a CSS-only layer
- 🪶 **Tiny and safe**: about 2 kB min+gzip, zero dependencies, SSR-safe (Next.js, Nuxt, SvelteKit, Astro), TypeScript types included

## Install

```bash
npm i foldjs            # core, CSS layer, Web Components, simulator
npm i @foldjs/react     # or @foldjs/vue, @foldjs/svelte, @foldjs/solid
```

## Quick start

### React (and Next.js)

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
      {process.env.NODE_ENV === "development" && <FoldDevtools initial="book" />}
    </>
  );
}
```

`@foldjs/react` is marked `"use client"`, so it works in the Next.js App Router out of the box.

### Vue (and Nuxt)

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

### Svelte (and SvelteKit)

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

### Solid

```tsx
import { createFold, twoPane } from "@foldjs/solid";

const fold = createFold(); // fold().posture

<div use:twoPane={{ fallback: "stack" }}>
  <div data-pane="primary"><MailList /></div>
  <div data-pane="secondary"><MailDetail /></div>
</div>
```

### Web Components (Angular, Lit, Astro, htmx, plain HTML)

```html
<script type="module">import "foldjs/elements";</script>

<fold-two-pane fallback="stack">
  <div slot="primary">List</div>
  <div slot="secondary">Detail</div>
</fold-two-pane>

<fold-when posture="tabletop book">Only on a split screen</fold-when>
```

### CSS only

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

CSS variables on `<html>`: `--fold-hinge-x|y|width|height`, `--fold-segment-0-width|height`, `--fold-segment-1-width|height`.
Attributes on `<html>`: `data-fold-posture`, `data-fold-spanning`.

## Test foldable layouts without a device

```js
import { mountDevtools } from "foldjs/devtools";
mountDevtools({ initial: "book", position: "bottom-right", hingeSize: 24 });
```

A floating panel lets you switch between **Device / Flat / Book / Tabletop** and draws the simulated hinge on screen. Press **Alt + Shift + F** to cycle postures. In tests, demos or Storybook, drive it from code: `simulate({ posture: "tabletop" })`, then `simulate(null)` to go back to the real device.

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

Writing an adapter for another framework? `subscribe` and `getFold` are all you need, and `twoPaneLayout(state)` returns the styles every built-in adapter uses.

## FAQ

### How do I detect a foldable phone in JavaScript?
Call `getFold()` from `foldjs` (or `useFold()` in React and Vue). `isSpanned` tells you whether the viewport is split by a hinge, `posture` tells you how the device is held, and `hinge` gives the hinge rectangle in CSS pixels. Under the hood fold.js reads `window.viewport.segments` and `navigator.devicePosture`, with a fallback for older Edge builds.

### How do I keep content away from the hinge in CSS?
Use the `fold-two-pane` class from `foldjs/css`, or the `--fold-hinge-*` and `--fold-segment-*` variables. On supporting browsers the CSS layer also uses the native `env(viewport-segment-*)` values and the `horizontal-viewport-segments` / `vertical-viewport-segments` media queries.

### What is the difference between book and tabletop posture?
**Book** means the hinge is vertical and the two screens are side by side, like an open book: ideal for list and detail. **Tabletop** means the hinge is horizontal, like a half-open laptop: ideal for a video or camera on top and controls at the bottom.

### Can I build for foldables without owning one?
Yes. The built-in simulator (`<FoldDevtools />`, `<FoldDevtools>` in Vue, or `mountDevtools()` anywhere) fakes the segments and posture on any desktop browser. Chrome DevTools device emulation (Galaxy Z Fold, Surface Duo) also works with fold.js.

### Which devices and browsers are supported?
Chrome and Edge on Android foldables (Samsung Galaxy Z Fold, Google Pixel Fold, Honor, Oppo, Vivo, Surface Duo) support the native APIs. On every other browser, including Samsung Internet, Firefox and Safari on iOS, fold.js falls back to a normal single-screen layout and the simulator still works.

### Does fold.js work with server-side rendering?
Yes. On the server the state is a flat, unsplit screen, and it updates on the client after hydration. It works with Next.js, Nuxt, SvelteKit, Remix and Astro.

### Is fold.js a replacement for react-foldable or react-native-dualscreen?
For the web, yes. Those Microsoft packages are archived and rely on the deprecated `spanning` media query and `getWindowSegments()`. fold.js uses the current standards and supports more frameworks. It does not target React Native.

## Browser support

| | Native APIs | With fold.js |
|---|---|---|
| Chrome / Edge on Android foldables | ✅ Viewport Segments + Device Posture | ✅ Full support |
| Samsung Internet, Firefox, Safari | ❌ | ✅ Single-screen fallback, simulator |
| Desktop browsers | ❌ | ✅ Simulator |

## Packages

| Package | Description |
|---|---|
| [`foldjs`](https://www.npmjs.com/package/foldjs) | Core API, CSS layer (`foldjs/css`), Web Components (`foldjs/elements`), simulator (`foldjs/devtools`) |
| [`@foldjs/react`](https://www.npmjs.com/package/@foldjs/react) | `useFold`, `<TwoPane>`, `<FoldWhen>`, `<FoldDevtools>` |
| [`@foldjs/vue`](https://www.npmjs.com/package/@foldjs/vue) | `useFold`, `<TwoPane>`, `<FoldWhen>`, `<FoldDevtools>` |
| [`@foldjs/svelte`](https://www.npmjs.com/package/@foldjs/svelte) | `fold` store, `use:twoPane`, `use:foldWhen` |
| [`@foldjs/solid`](https://www.npmjs.com/package/@foldjs/solid) | `createFold`, `use:twoPane` |

## Contributing

```bash
npm install
npm run dev        # demo on http://localhost:5173
npm test
npm run build
```

Issues and pull requests are welcome, especially reports from people testing on real foldable devices.

## License

MIT
