import { existsSync } from "node:fs";
import { join } from "node:path";

/** Finds an installed Chromium-based browser, so the CLI never downloads one. */
export function findBrowser(explicit?: string): string | null {
  const candidates = [explicit, process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, ...platformPaths()];
  return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

function platformPaths(): string[] {
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean) as string[];
    return roots.flatMap((r) => [
      join(r, "Google/Chrome/Application/chrome.exe"),
      join(r, "Microsoft/Edge/Application/msedge.exe"),
      join(r, "Chromium/Application/chrome.exe"),
      join(r, "BraveSoftware/Brave-Browser/Application/brave.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ];
}
