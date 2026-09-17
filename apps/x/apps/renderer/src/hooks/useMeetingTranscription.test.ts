import { describe, expect, it } from 'vitest';
import { MEETINGS_FOLDER } from '@x/shared/dist/brand.js';

// The transcription hook (useMeetingTranscription.ts) builds note paths as
// `knowledge/Meetings/${MEETINGS_FOLDER}/<date>/<file>.md`. New notes go to
// Meetings/spinrun/; old notes under Meetings/rowboat/ stay on disk and are
// still read via the inline_task_agent dual-path prompt.
describe('transcription hook writes under the new folder', () => {
  it('MEETINGS_FOLDER is spinrun', () => {
    expect(MEETINGS_FOLDER).toBe('spinrun');
  });

  it('note path template resolves under Meetings/spinrun/', () => {
    const dateFolder = '2026-03-30';
    const filename = 'meeting-2026-03-30T13-49-27.md';
    const notePath = `knowledge/Meetings/${MEETINGS_FOLDER}/${dateFolder}/${filename}`;
    expect(notePath).toBe('knowledge/Meetings/spinrun/2026-03-30/meeting-2026-03-30T13-49-27.md');
  });
});
