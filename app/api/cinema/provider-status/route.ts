import 'server-only';

import { publicProviderError } from '../../../server/cinema/provider-errors';
import { workflowCapabilities } from '../../../server/cinema/workflow-capabilities';

export async function GET(): Promise<Response> {
  try {
    // Read-only compatibility route. The editor uses workflow-capabilities;
    // older consumers receive a projection of that same source, not new policy.
    return Response.json(workflowCapabilities().legacyPlanning, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ ok: false, error: publicProviderError(error) }, { status: 503 });
  }
}
