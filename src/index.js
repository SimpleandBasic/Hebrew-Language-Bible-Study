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
import {
  generateNextSpokenHebrewAudioSegment,
  getSpokenHebrewAudioStatus,
  getSpokenHebrewLearningState,
  getSpokenHebrewLesson,
  listSpokenHebrewLessons,
  recordSpokenHebrewPractice,
  setSpokenHebrewCurrentLesson,
} from './actions/spoken-hebrew-tools.js';

export const toolRegistry = {
  get_hebrew_app_status: { handler: getHebrewAppStatus },
  draft_hebrew_lesson_bundle: { handler: draftHebrewLessonBundle },
  preview_hebrew_lesson_bundle: { handler: previewHebrewLessonBundle },
  publish_hebrew_lesson_bundle: { handler: publishHebrewLessonBundle },
  list_pending_hebrew_lessons: { handler: listPendingHebrewLessons },
  prepare_hebrew_audio_track: { handler: prepareHebrewAudioTrack },
  generate_next_hebrew_audio_segment: { handler: generateNextHebrewAudioSegment },
  get_hebrew_audio_status: { handler: getHebrewAudioStatus },
  get_spoken_hebrew_learning_state: { handler: getSpokenHebrewLearningState },
  list_spoken_hebrew_lessons: { handler: listSpokenHebrewLessons },
  get_spoken_hebrew_lesson: { handler: getSpokenHebrewLesson },
  set_spoken_hebrew_current_lesson: { handler: setSpokenHebrewCurrentLesson },
  record_spoken_hebrew_practice: { handler: recordSpokenHebrewPractice },
  generate_next_spoken_hebrew_audio_segment: { handler: generateNextSpokenHebrewAudioSegment },
  get_spoken_hebrew_audio_status: { handler: getSpokenHebrewAudioStatus },
};

export async function runTool(name, input, options) {
  const tool = toolRegistry[name];
  if (!tool) throw new Error('Unknown tool: ' + name);
  return tool.handler(input, options);
}