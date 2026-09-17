import { beforeEach, describe, expect, it } from 'vitest';
import { selectInitialModel, selectInitialTaskModels } from './initial-selection.js';
import { MANAGED_LLM_ENABLED } from './managed.js';

beforeEach(() => {
    // Managed-on by default so the pre-existing rowboat picks pin the
    // enabled behavior; off-cases set ROWBOAT_MANAGED_LLM explicitly.
    process.env.ROWBOAT_MANAGED_LLM = 'on';
});

describe('selectInitialModel', () => {
    const recommendations = {
        openai: 'gpt-5.4',
        openrouter: 'anthropic/claude-opus-4.8',
    };

    it('picks the recommended model when the provider lists it', () => {
        expect(selectInitialModel('openai', ['gpt-4.1', 'gpt-5.4', 'gpt-5.4-mini'], recommendations))
            .toEqual({ model: 'gpt-5.4' });
    });

    it('falls back to the first listed model when the recommendation is not in the list', () => {
        expect(selectInitialModel('openai', ['gpt-4.1', 'gpt-4o'], recommendations))
            .toEqual({ model: 'gpt-4.1' });
    });

    it('falls back to the first listed model for flavors with no recommendation', () => {
        expect(selectInitialModel('ollama', ['llama3', 'qwen3'], recommendations))
            .toEqual({ model: 'llama3' });
    });

    it('falls back to the first listed model when no recommendations map is available', () => {
        expect(selectInitialModel('openai', ['gpt-4.1'], undefined)).toEqual({ model: 'gpt-4.1' });
    });

    it('returns null when the provider listed nothing', () => {
        expect(selectInitialModel('openai', [], recommendations)).toBeNull();
    });

    it('accepts the nested { assistantModel, taskModels } wire shape', () => {
        const nested = { rowboat: { assistantModel: 'google/gemini-3.5-flash', taskModels: {} } };
        expect(selectInitialModel('rowboat', ['a', 'google/gemini-3.5-flash'], nested))
            .toEqual({ model: 'google/gemini-3.5-flash' });
    });

    it('carries effort from the { model, effort } wire shape', () => {
        const nested = { rowboat: { assistantModel: { model: 'google/gemini-3.5-flash', effort: 'high' as const } } };
        expect(selectInitialModel('rowboat', ['google/gemini-3.5-flash'], nested))
            .toEqual({ model: 'google/gemini-3.5-flash', effort: 'high' });
    });
});

describe('selectInitialTaskModels', () => {
    const gatewayList = [
        'google/gemini-3.5-flash',
        'google/gemini-3.1-flash-lite',
        'google/gemini-3.5-flash-lite',
    ];
    const nested = {
        rowboat: {
            assistantModel: 'google/gemini-3.5-flash',
            taskModels: {
                knowledgeGraph: 'google/gemini-3.1-flash-lite',
                chatTitle: 'google/gemini-3.5-flash-lite',
                // Equal to the assistant → redundant, inherit produces it.
                meetingNotes: 'google/gemini-3.5-flash',
                // Not in the provider's list → stale hint, skipped.
                liveNoteAgent: 'google/gemini-9-experimental',
                // Unknown key → ignored.
                somethingNew: 'google/gemini-3.1-flash-lite',
            },
        },
    };

    it('writes overrides only for listed recs that differ from the assistant', () => {
        expect(selectInitialTaskModels('rowboat', 'rowboat', gatewayList, nested, { model: 'google/gemini-3.5-flash' }))
            .toEqual({
                knowledgeGraph: { provider: 'rowboat', model: 'google/gemini-3.1-flash-lite' },
                chatTitle: { provider: 'rowboat', model: 'google/gemini-3.5-flash-lite' },
            });
    });

    it('returns nothing for legacy flat recommendations or absent maps', () => {
        expect(selectInitialTaskModels('rowboat', 'rowboat', gatewayList, { rowboat: 'google/gemini-3.5-flash' }, { model: 'x' }))
            .toEqual({});
        expect(selectInitialTaskModels('rowboat', 'rowboat', gatewayList, undefined, { model: 'x' })).toEqual({});
    });

    it('keeps a same-model rec whose effort differs from the assistant, and carries effort', () => {
        const withEffort = {
            rowboat: {
                assistantModel: { model: 'google/gemini-3.5-flash', effort: 'high' as const },
                taskModels: {
                    // Same model, lower effort → meaningful override.
                    chatTitle: { model: 'google/gemini-3.5-flash', effort: 'low' as const },
                    // Same model AND effort → redundant, inherit produces it.
                    meetingNotes: { model: 'google/gemini-3.5-flash', effort: 'high' as const },
                },
            },
        };
        expect(selectInitialTaskModels('rowboat', 'rowboat', gatewayList, withEffort, { model: 'google/gemini-3.5-flash', effort: 'high' }))
            .toEqual({
                chatTitle: { provider: 'rowboat', model: 'google/gemini-3.5-flash', effort: 'low' },
            });
    });
});

describe('MANAGED_LLM_ENABLED switch (rowboat auto-select)', () => {
    const nested = { rowboat: { assistantModel: 'google/gemini-3.5-flash', taskModels: {} } };

    it('when on, a rowboat initial pick is returned', () => {
        process.env.ROWBOAT_MANAGED_LLM = 'on';
        expect(MANAGED_LLM_ENABLED()).toBe(true);
        expect(selectInitialModel('rowboat', ['a', 'google/gemini-3.5-flash'], nested))
            .toEqual({ model: 'google/gemini-3.5-flash' });
    });

    it('when off, a rowboat initial pick falls back to null (first BYOK or none)', () => {
        process.env.ROWBOAT_MANAGED_LLM = 'off';
        expect(MANAGED_LLM_ENABLED()).toBe(false);
        expect(selectInitialModel('rowboat', ['a', 'google/gemini-3.5-flash'], nested)).toBeNull();
    });

    it('when off, rowboat task overrides fall back to {} (inherit assistant)', () => {
        process.env.ROWBOAT_MANAGED_LLM = 'off';
        const gatewayList = ['google/gemini-3.5-flash', 'google/gemini-3.1-flash-lite'];
        const withTasks = {
            rowboat: {
                assistantModel: 'google/gemini-3.5-flash',
                taskModels: { knowledgeGraph: 'google/gemini-3.1-flash-lite' },
            },
        };
        expect(selectInitialTaskModels('rowboat', 'rowboat', gatewayList, withTasks, { model: 'google/gemini-3.5-flash' }))
            .toEqual({});
    });

    it('when off, BYOK flavors still fall back to their first listed model', () => {
        process.env.ROWBOAT_MANAGED_LLM = 'off';
        expect(selectInitialModel('ollama', ['llama3', 'qwen3'], undefined)).toEqual({ model: 'llama3' });
    });
});
