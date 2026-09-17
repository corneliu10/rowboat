import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPostHogCtor = vi.hoisted(() => vi.fn());

vi.mock("posthog-node", () => ({
  PostHog: mockPostHogCtor,
}));

vi.mock("./installation.js", () => ({
  getInstallationId: () => "test-installation-id",
}));

const ENV_KEYS = ["POSTHOG_KEY", "VITE_PUBLIC_POSTHOG_KEY", "ROWBOAT_TELEMETRY"] as const;
let savedEnv: Record<string, string | undefined>;

function clearTelemetryEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

async function importPosthogFresh() {
  vi.resetModules();
  return await import("./posthog.js");
}

describe("main analytics telemetry switch", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    clearTelemetryEnv();
    mockPostHogCtor.mockClear();
    mockPostHogCtor.mockImplementation(() => ({
      capture: vi.fn(),
      identify: vi.fn(),
      alias: vi.fn(),
      isFeatureEnabled: vi.fn(),
      shutdown: vi.fn(),
    }));
  });

  afterEach(() => {
    clearTelemetryEnv();
    for (const k of ENV_KEYS) {
      if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
    }
    vi.resetModules();
  });

  it("with no POSTHOG_KEY / VITE_PUBLIC_POSTHOG_KEY, no client is constructed and capture is a no-op", async () => {
    clearTelemetryEnv();
    const mod = await importPosthogFresh();
    expect(mod.isTelemetryEnabled()).toBe(true);
    mod.capture("test_event", { foo: 1 });
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    await expect(mod.isFeatureEnabled("any-flag", false)).resolves.toBe(false);
    expect(mockPostHogCtor).not.toHaveBeenCalled();
  });

  it("with ROWBOAT_TELEMETRY=off and a key present, no client is constructed and capture is a no-op", async () => {
    process.env.POSTHOG_KEY = "phc_testkey1234567890";
    process.env.ROWBOAT_TELEMETRY = "off";
    const mod = await importPosthogFresh();
    expect(mod.isTelemetryOff()).toBe(true);
    expect(mod.isTelemetryEnabled()).toBe(false);
    mod.capture("test_event", { foo: 1 });
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    mod.identify("user-1");
    expect(mockPostHogCtor).not.toHaveBeenCalled();
  });

  it("with a key and telemetry on, a client is constructed (off switch is what disables it)", async () => {
    process.env.POSTHOG_KEY = "phc_testkey1234567890";
    delete process.env.ROWBOAT_TELEMETRY;
    const mod = await importPosthogFresh();
    expect(mod.isTelemetryEnabled()).toBe(true);
    mod.capture("test_event");
    expect(mockPostHogCtor).toHaveBeenCalledOnce();
  });
});
