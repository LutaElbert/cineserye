export type PlanningUiState = 'idle' | 'planning' | 'ready' | 'accepted';

export const PLANNING_LABELS: Record<PlanningUiState, string> = {
  idle: 'Generate shot plan',
  planning: 'Generating shot plan',
  ready: 'Review shot plan',
  accepted: 'Review shot plan',
};

export function planningLabel(state: PlanningUiState) {
  return PLANNING_LABELS[state];
}
