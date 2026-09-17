import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    register: vi.fn(),
    people: {
      set: vi.fn(),
      set_once: vi.fn(),
    },
  },
}));

import posthog from "posthog-js";
import {
  setTelemetryEnabled,
  isTelemetryEnabled,
  shouldEnableTelemetry,
  chatSessionCreated,
  viewOpened,
  configureAnalyticsContext,
} from "./analytics";

describe("renderer analytics telemetry switch", () => {
  beforeEach(() => {
    setTelemetryEnabled(true);
    vi.clearAllMocks();
  });

  it("with no key, shouldEnableTelemetry is false (no client constructed)", () => {
    expect(shouldEnableTelemetry({})).toBe(false);
    expect(shouldEnableTelemetry({ posthogKey: "" })).toBe(false);
    expect(shouldEnableTelemetry({ posthogKey: undefined })).toBe(false);
  });

  it("with a key and telemetry on, shouldEnableTelemetry is true", () => {
    expect(shouldEnableTelemetry({ posthogKey: "phc_test", telemetryEnabled: true })).toBe(true);
  });

  it("off switch is honoured even if a key is present", () => {
    expect(shouldEnableTelemetry({ posthogKey: "phc_test", telemetryEnabled: false })).toBe(false);
  });

  it("when disabled, capture wrappers are no-ops (no client calls)", () => {
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    chatSessionCreated("run-1");
    viewOpened("chat");
    configureAnalyticsContext({ appVersion: "0.1.0", apiUrl: "https://api.example" });
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.register).not.toHaveBeenCalled();
    expect(posthog.people.set).not.toHaveBeenCalled();
  });

  it("when enabled, wrappers forward to posthog", () => {
    setTelemetryEnabled(true);
    chatSessionCreated("run-1");
    expect(posthog.capture).toHaveBeenCalledOnce();
  });
});
