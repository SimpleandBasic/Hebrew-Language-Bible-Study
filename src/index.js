import {
  draftHebrewLessonBundle,
  getHebrewAppStatus,
  listPendingHebrewLessons,
  previewHebrewLessonBundle,
  publishHebrewLessonBundle,
} from './actions/hebrew-tools.js';
import {
  generateNextHebrewAudioSegment,
  getHebrewAudioStatus,
  prepareHebrewAudioTrack,
} from './actions/audio-tools.js';

export const toolRegistry = {
  get_hebrew_app_status: { handler: getHebrewAppStatus },
  draft_hebrew_lesson_bundle: { handler: draftHebrewLessonBundle },
  preview_hebrew_lesson_bundle: { handler: previewHebrewLessonBundle },
  publish_hebrew_lesson_bundle: { handler: publishHebrewLessonBundle },
  list_pending_hebrew_lessons: { handler: listPendingHebrewLessons },
  prepare_hebrew_audio_track: { handler: prepareHebrewAudioTrack },
  generate_next_hebrew_audio_segment: { handler: generateNextHebrewAudioSegment },
  get_hebrew_audio_status: { handler: getHebrewAudioStatus },
};

export async function runTool(name, input, options) {
  const tool = toolRegistry[name];
  if (!tool) throw new Error('Unknown tool: ' + name);
  return tool.handler(input, options);
}
