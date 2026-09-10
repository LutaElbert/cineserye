import { createStoryHandler, storyQuote } from '../../../server/cinema/story-development';
import { localOperationExecutor } from '../../../server/cinema/operation-repository';
export const POST = createStoryHandler();
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('operationId')) {
    const operationId = url.searchParams.get('operationId') ?? '';
    const projectId = url.searchParams.get('projectId') ?? '';
    if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(projectId) || !/^[a-f0-9-]{36}$/.test(operationId)) return Response.json({ error: 'Invalid operation identity.' }, { status: 400 });
    try {
      const row = (await localOperationExecutor()).read(`story:${projectId}:${operationId}`);
      return Response.json({ status: row?.status ?? 'unknown', result: row?.status === 'completed' && row.result ? JSON.parse(row.result) : null });
    } catch { return Response.json({ status: 'unknown', result: null }, { status: 503 }); }
  }
  try { return Response.json(storyQuote(url.searchParams.get('mode') === 'live' ? 'live' : 'fixture')); }
  catch { return Response.json({ error: 'Story provider configuration is unavailable.' }, { status: 503 }); }
}
