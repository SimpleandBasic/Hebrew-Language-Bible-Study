import {
  draftHebrewLessonBundle,
  getHebrewAppStatus,
  listPendingHebrewLessons,
  previewHebrewLessonBundle,
  publishHebrewLessonBundle,
} from './actions/hebrew-tools.js';

export const toolRegistry = {
  get_hebrew_app_status: { handler: getHebrewAppStatus },
  draft_hebrew_lesson_bundle: { handler: draftHebrewLessonBundle },
  preview_hebrew_lesson_bundle: { handler: previewHebrewLessonBundle },
  publish_hebrew_lesson_bundle: { handler: publishHebrewLessonBundle },
  list_pending_hebrew_lessons: { handler: listPendingHebrewLessons },
};

export async function runTool(name, input, options) {
  const tool = toolRegistry[name];
  if (!tool) throw new Error('Unknown tool: ' + name);
  return tool.handler(input, options);
}
