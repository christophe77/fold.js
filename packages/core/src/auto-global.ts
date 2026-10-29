// Script-tag bundle (dist/auto.global.js): one line to retrofit an existing site.
//
//   <script src="https://unpkg.com/foldjs/dist/auto.global.js"></script>
//   <script src="…/auto.global.js" data-columns="false" data-gutter="24"></script>
import { autoFix } from "./auto";
import type { AutoFixOptions } from "./auto";

const script = document.currentScript as HTMLScriptElement | null;
const data = script?.dataset ?? {};
const flag = (v: string | undefined) => (v === undefined ? undefined : v !== "false");

const options: AutoFixOptions = {
  modals: flag(data.modals),
  avoid: flag(data.avoid),
  columns: flag(data.columns),
  media: flag(data.media),
  bars: flag(data.bars),
  consent: flag(data.consent),
  gutter: data.gutter ? Number(data.gutter) : undefined,
};
for (const key of Object.keys(options) as Array<keyof AutoFixOptions>) if (options[key] === undefined) delete options[key];

const start = () => {
  stop = autoFix(options);
};
let stop: (() => void) | undefined;
if (document.body) start();
else document.addEventListener("DOMContentLoaded", start, { once: true });

export { autoFix };
export const disable = () => stop?.();
