import { workflowCapabilities } from '../../../server/cinema/workflow-capabilities';
export async function GET() {
  try { return Response.json(workflowCapabilities(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: 'Workflow capability configuration is unavailable. No generation was started.' }, { status: 503 }); }
}
