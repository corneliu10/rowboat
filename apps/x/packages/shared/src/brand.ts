export const brand = Object.freeze({
  productName: "Spinrun",
  executableName: "spinrun",
  appBundleId: "ai.spinrun.desktop",
  updateRepo: "corneliu10/rowboat",
  deepLinkScheme: "spinrun",
  upstream: "rowboatlabs/rowboat",
  assistantName: "Spinball",
  mentionHandle: "spinball",
  companyName: "Spinrun",
  siteUrl: "https://spinrun.ai",
  docsUrl: "https://spinrun.ai/docs",
  supportUrl: "https://spinrun.ai/support",
});

export type Brand = typeof brand;

// Code-session worktree branch prefix, e.g. "spinrun/". Built from
// brand.executableName so the user-visible prefix follows the rebrand;
// existing sessions keep their stored branch (callers use `??` fallback).
export const CODE_SESSION_BRANCH_PREFIX = `${brand.executableName}/`;

// Local meeting-notes source folder, e.g. "spinrun" → knowledge/Meetings/spinrun/.
// Built from brand.executableName; old notes under Meetings/rowboat/ stay on disk.
export const MEETINGS_FOLDER = brand.executableName;
