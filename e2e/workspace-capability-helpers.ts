import type { Page, Route } from '@playwright/test';
import { WorkflowCapabilitiesSchema } from '../app/features/story-development/workflow-capabilities';
import type { CinemaProviderStatus } from '../app/features/scene-planner/plan-scene-api';

/** Review-only fake Live discovery. The server remains fixture-only and tests
 * independently intercept/abort chargeable POSTs. No provider is enabled. */
export async function fulfillWorkspaceMode(route: Route, mode: 'fixture' | 'live', legacy: Partial<CinemaProviderStatus> = {}) {
  const response = await route.fetch({ headers: { ...route.request().headers(), 'accept-encoding': 'identity' } });
  const value = WorkflowCapabilitiesSchema.parse(await response.json());
  value.mode = mode; value.analysis.mode = mode; value.story.mode = mode;
  value.legacyPlanning = { ...value.legacyPlanning, ...legacy, mode, requiresContentTransferConsent: mode === 'live' };
  for (const stage of Object.values(value.stages)) {
    if (stage.status === 'fixture' && mode === 'live') stage.status = 'configured-unverified';
    if (stage.status === 'configured-unverified' && mode === 'fixture') stage.status = 'fixture';
  }
  await route.fulfill({ json: WorkflowCapabilitiesSchema.parse(value) });
}

export async function refreshWorkspaceDiscovery(page: Page) {
  await page.getByRole('button', { name: /Open provider status and local traces\./ }).click();
  const diagnostics = page.getByRole('dialog', { name: 'Provider status and local traces', exact: true });
  await diagnostics.getByRole('button', { name: 'Refresh workspace status', exact: true }).click();
  await diagnostics.getByRole('button', { name: 'Close', exact: true }).click();
}
