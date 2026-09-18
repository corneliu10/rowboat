/**
 * Static Spinrun bearer for the spike (lane G).
 *
 * Reads `SPINRUN_API_KEY` from the process environment and returns it when it
 * looks like a Spinrun key (starts with `spr_`), else null. The key lives
 * ONLY in the environment of the app process — it is never written to any
 * file, including the app's config.
 */

export const STATIC_SPINRUN_KEY_ENV_VAR = "SPINRUN_API_KEY" as const;
const STATIC_KEY_PREFIX = "spr_" as const;

export function staticSpinrunKey(): string | null {
    const raw = process.env[STATIC_SPINRUN_KEY_ENV_VAR];
    if (typeof raw === "string" && raw.startsWith(STATIC_KEY_PREFIX)) {
        return raw;
    }
    return null;
}
