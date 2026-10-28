// A plain mobile site (no framework, no fold.js layout) used to show foldjs/auto
// and the live hinge collision outlines of the simulator.
import { autoFix } from "foldjs/auto";
import { mountDevtools } from "foldjs/devtools";
import "./legacy.css";

const toggle = document.getElementById("toggle")!;
const modal = document.querySelector<HTMLElement>(".modal")!;
let stop: (() => void) | null = null;

function setAuto(on: boolean) {
  stop?.();
  stop = on ? autoFix() : null;
  toggle.setAttribute("aria-pressed", String(on));
  toggle.querySelector("strong")!.textContent = on ? "on" : "off";
  const url = new URL(location.href);
  if (on) url.searchParams.set("auto", "1");
  else url.searchParams.delete("auto");
  history.replaceState(null, "", url);
}

toggle.addEventListener("click", () => setAuto(!stop));
document.getElementById("book")!.addEventListener("click", () => (modal.hidden = false));
document.getElementById("confirm")!.addEventListener("click", () => (modal.hidden = true));

// The modal starts open so its position is visible right away.
modal.hidden = new URLSearchParams(location.search).get("modal") === "0";
setAuto(new URLSearchParams(location.search).get("auto") === "1");
mountDevtools({ initial: "book" });
