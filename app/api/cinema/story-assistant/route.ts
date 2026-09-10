import { createAssistantHandlers } from '../../../server/cinema/story-assistant';
const handlers = createAssistantHandlers();
export const POST = handlers.POST;
export const GET = handlers.GET;
