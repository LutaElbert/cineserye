'use client';

import { capabilityDescription, capabilityLabels, capabilityStatusLabels, type WorkflowCapabilities } from '../story-development/workflow-capabilities';

export type ExecutionFeature = 'images' | 'video' | 'assembly';

/** Discovery permits request review, not execution. Endpoint preflight and
 * explicit input/spending approval remain separate, authoritative checks. */
export function workspaceFeature(capabilities: WorkflowCapabilities | null, feature: ExecutionFeature) {
  const stage = capabilities?.stages[feature];
  return {
    mode: capabilities?.mode ?? 'loading' as const,
    canReview: Boolean(stage && capabilities?.runtime === 'local-node' && stage.configured && stage.enabled && stage.status !== 'blocked'),
    label: stage ? capabilityStatusLabels[stage.status] : 'Unknown',
    description: stage ? capabilityDescription(stage) : 'Availability is unknown. Refresh workspace status. Manual editing and local media remain accessible.',
  };
}

export function WorkspaceFeatureStatus({ capabilities, feature }: { capabilities: WorkflowCapabilities | null; feature: ExecutionFeature }) {
  const state = workspaceFeature(capabilities, feature);
  return <section className="workspace-feature-status" aria-label={`${capabilityLabels[feature]} workspace status`}>
    <strong>{capabilityLabels[feature]} · {state.label}</strong><p>{state.description}</p>
  </section>;
}
