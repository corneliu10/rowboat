// Pure selection logic lives in @x/shared (the renderer's connect flow uses
// the same implementation); wrapped here so the managed-provider switch can
// block the rowboat auto-select. When MANAGED_LLM_ENABLED() is off, a
// "rowboat" initial pick returns null / {} — the caller falls back to the
// first configured BYOK provider or to "none" with the settings prompt.
import {
    selectInitialModel as selectInitialModelShared,
    selectInitialTaskModels as selectInitialTaskModelsShared,
} from "@x/shared/dist/initial-selection.js";
import { MANAGED_LLM_ENABLED } from "./managed.js";

export function selectInitialModel(
    ...args: Parameters<typeof selectInitialModelShared>
): ReturnType<typeof selectInitialModelShared> {
    const [flavor] = args;
    if (flavor === "rowboat" && !MANAGED_LLM_ENABLED()) return null;
    return selectInitialModelShared(...args);
}

export function selectInitialTaskModels(
    ...args: Parameters<typeof selectInitialTaskModelsShared>
): ReturnType<typeof selectInitialTaskModelsShared> {
    const [, flavor] = args;
    if (flavor === "rowboat" && !MANAGED_LLM_ENABLED()) return {};
    return selectInitialTaskModelsShared(...args);
}
