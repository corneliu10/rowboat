import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockBrand = vi.hoisted(() => ({
  productName: "Spinrun Desktop",
  executableName: "spinrun-desktop",
  appBundleId: "ai.spinrun.desktop",
  updateRepo: "corneliu10/rowboat",
  deepLinkScheme: "rowboat",
  upstream: "rowboatlabs/rowboat",
}));

vi.mock("@x/shared", () => ({
  brand: mockBrand,
}));

vi.mock("@x/core/dist/analytics/posthog.js", () => ({
  capture: vi.fn(),
}));

vi.mock("./dock-badge.js", () => ({
  setDockUpdateReady: vi.fn(),
}));

const mockSetFeedURL = vi.fn();
const mockCheckForUpdates = vi.fn();
const mockOn = vi.fn();

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.1.0",
    isPackaged: true,
    isInApplicationsFolder: () => true,
  },
  autoUpdater: {
    on: (...args: unknown[]) => mockOn(...(args as [])),
    setFeedURL: (...args: unknown[]) => mockSetFeedURL(...(args as [])),
    checkForUpdates: (...args: unknown[]) => mockCheckForUpdates(...(args as [])),
    quitAndInstall: vi.fn(),
  },
  net: {
    fetch: vi.fn(),
  },
  nativeImage: {
    createFromDataURL: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

import {
  buildUpdateFeedUrl,
  buildReleaseNotesUrl,
  getUpdateRepo,
  initUpdater,
  getUpdaterStatus,
} from "./updater.js";

describe("updater brand wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBrand.updateRepo = "corneliu10/rowboat";
    vi.stubGlobal("setInterval", vi.fn(() => 0 as unknown as NodeJS.Timeout));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockBrand.updateRepo = "corneliu10/rowboat";
  });

  it("with the repo unset, no URL is constructed", () => {
    expect(buildUpdateFeedUrl("", "darwin", "arm64", "0.1.0")).toBeNull();
    expect(buildReleaseNotesUrl("", "v0.1.0")).toBeNull();
  });

  it('with "corneliu10/rowboat", the feed URL contains it and never "rowboatlabs"', () => {
    const url = buildUpdateFeedUrl("corneliu10/rowboat", "darwin", "arm64", "0.1.0");
    expect(url).toBe(
      "https://update.electronjs.org/corneliu10/rowboat/darwin-arm64/0.1.0",
    );
    expect(url).toContain("corneliu10/rowboat");
    expect(url).not.toContain("rowboatlabs");
    const notes = buildReleaseNotesUrl("corneliu10/rowboat", "v0.1.0");
    expect(notes).toContain("corneliu10/rowboat");
    expect(notes).not.toContain("rowboatlabs");
  });

  it("getUpdateRepo returns the fork repo, never upstream", () => {
    expect(getUpdateRepo()).toBe("corneliu10/rowboat");
    expect(getUpdateRepo()).not.toContain("rowboatlabs");
  });

  it("initUpdater reports disabled/no-update-repo and never fetches when repo is empty", () => {
    mockBrand.updateRepo = "";
    initUpdater();
    expect(getUpdaterStatus()).toEqual({
      state: "disabled",
      version: "0.1.0",
      reason: "no-update-repo",
    });
    expect(mockSetFeedURL).not.toHaveBeenCalled();
    expect(mockCheckForUpdates).not.toHaveBeenCalled();
  });

  it("initUpdater points the feed at the fork, never upstream", () => {
    mockBrand.updateRepo = "corneliu10/rowboat";
    initUpdater();
    expect(mockSetFeedURL).toHaveBeenCalledOnce();
    const arg = mockSetFeedURL.mock.calls[0]?.[0] as { url: string };
    expect(arg.url).toContain("corneliu10/rowboat");
    expect(arg.url).not.toContain("rowboatlabs");
  });
});
