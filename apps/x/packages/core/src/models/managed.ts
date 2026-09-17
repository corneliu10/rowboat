/**
 * Single switch for the managed (Spinrun-hosted) LLM provider ("rowboat").
 *
 * Read from env ROWBOAT_MANAGED_LLM, default "off" in this fork. When off,
 * the rowboat provider is not listed (catalog.ts), not auto-selected
 * (initial-selection.ts, rowboat-selection.ts), and initial selection falls
 * back to the first configured BYOK provider or to "none" with the settings
 * prompt. Do not delete gateway.ts — the transport stays for a future
 * Spinrun-routed provider.
 */

export const MANAGED_LLM_ENV_VAR = "ROWBOAT_MANAGED_LLM" as const;

/**
 * Live switch: "on" / "1" / "true" (case-insensitive) enables the managed
 * provider; anything else (including unset → "off") disables it.
 */
export const MANAGED_LLM_ENABLED = (): boolean => {
    const raw = (process.env[MANAGED_LLM_ENV_VAR] ?? "off").trim().toLowerCase();
    return raw === "on" || raw === "1" || raw === "true";
};
