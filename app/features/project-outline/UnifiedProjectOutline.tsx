import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  ListVideo,
  Lock,
  MapPin,
  Package,
  Plus,
  Sparkles,
  StickyNote,
  Unlock,
  UserRound,
} from 'lucide-react';
import { useId } from 'react';
import type {
  UnifiedOutlineGroupId,
  UnifiedOutlineItem,
  UnifiedOutlineModel,
  UnifiedOutlineScene,
} from './unified-outline-model';

export type UnifiedOutlineBranchId = string;

type UnifiedProjectOutlineProps = {
  model: UnifiedOutlineModel;
  selectedNodeId: string | null;
  collapsedBranches: ReadonlySet<UnifiedOutlineBranchId>;
  proposalPreview: boolean;
  searchActive: boolean;
  onToggleBranch: (id: UnifiedOutlineBranchId) => void;
  onSelectNode: (id: string, additive?: boolean) => void;
  onFocusNodes: (ids: string[]) => void;
  onAddToScene: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
};

function groupIcon(id: UnifiedOutlineGroupId) {
  if (id === 'planning') return <Bot size={12} />;
  if (id === 'characters') return <UserRound size={12} />;
  if (id === 'locations') return <MapPin size={12} />;
  if (id === 'shots') return <ListVideo size={12} />;
  if (id === 'visual-elements') return <Sparkles size={12} />;
  if (id === 'notes') return <StickyNote size={12} />;
  return <Package size={12} />;
}

function itemGlyph(item: UnifiedOutlineItem) {
  if (item.kind === 'agent-run') return 'AI';
  return item.kind.slice(0, 1).toUpperCase();
}

function statusClass(item: UnifiedOutlineItem) {
  return `outline-status-badge status-${item.state}`;
}

function OutlineItemRow({
  item,
  selected,
  proposalPreview,
  onSelectNode,
  onToggleVisibility,
  onToggleLock,
}: {
  item: UnifiedOutlineItem;
  selected: boolean;
  proposalPreview: boolean;
  onSelectNode: (id: string, additive?: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
}) {
  const statusId = useId();
  return (
    <li className="outline-item">
      <div className={`outline-item-row ${selected ? 'active' : ''} status-${item.state}`}>
        <button
          type="button"
          className="outline-item-main"
          data-layer-id={item.nodeId}
          aria-label={item.title}
          aria-describedby={statusId}
          aria-pressed={selected}
          onClick={(event) => onSelectNode(item.nodeId, event.metaKey || event.ctrlKey)}
        >
          <span className={`cinema-layer-glyph kind-${item.kind} role-${item.kind}`} data-glyph={itemGlyph(item)} aria-hidden="true" />
          <span className="outline-item-name">{item.title}</span>
          {item.metricLabel ? <span className="outline-item-metric">{item.metricLabel}</span> : null}
          <span id={statusId} className={statusClass(item)}>{item.statusLabel}</span>
        </button>
        <div className="outline-item-actions">
          <button
            type="button"
            className="layer-control"
            aria-label={`${item.hidden ? 'Show' : 'Hide'} ${item.title}`}
            disabled={proposalPreview}
            onClick={() => onToggleVisibility(item.nodeId)}
          >
            {item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            type="button"
            className="layer-control"
            aria-label={`${item.locked ? 'Unlock' : 'Lock'} ${item.title}`}
            disabled={proposalPreview}
            onClick={() => onToggleLock(item.nodeId)}
          >
            {item.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>
      </div>
    </li>
  );
}

function SceneBranch({
  scene,
  selectedNodeId,
  collapsedBranches,
  proposalPreview,
  searchActive,
  onToggleBranch,
  onSelectNode,
  onFocusNodes,
  onAddToScene,
  onToggleVisibility,
  onToggleLock,
}: Omit<UnifiedProjectOutlineProps, 'model'> & { scene: UnifiedOutlineScene }) {
  const statusId = useId();
  const sceneBranchId = `scene:${scene.item.nodeId}`;
  const sceneExpanded = searchActive || !collapsedBranches.has(sceneBranchId);
  const secondaryMetric = scene.expectedCostLabel.trim().toLocaleLowerCase()
    === scene.item.statusLabel.trim().toLocaleLowerCase()
    ? null
    : scene.expectedCostLabel;
  return <section className="outline-scene-branch" aria-label={`${scene.item.title} outline`}>
    <div className={`outline-summary-row outline-scene-row ${selectedNodeId === scene.item.nodeId ? 'active' : ''}`}>
      <button
        type="button"
        className="outline-disclosure"
        aria-label={`${sceneExpanded ? 'Collapse' : 'Expand'} ${scene.item.title}`}
        aria-expanded={sceneExpanded}
        onClick={() => onToggleBranch(sceneBranchId)}
      >
        {sceneExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      <button type="button" className="outline-summary-main" aria-label={scene.item.title} aria-describedby={statusId} aria-pressed={selectedNodeId === scene.item.nodeId} onClick={(event) => onSelectNode(scene.item.nodeId, event.metaKey || event.ctrlKey)}>
        <Clapperboard size={13} aria-hidden="true" />
        <span>{scene.item.title}</span>
        <span id={statusId} className={statusClass(scene.item)}>{scene.item.statusLabel}</span>
      </button>
      <div className="outline-scene-end">
        <button type="button" className="outline-scene-metrics" aria-label={`Focus ${scene.item.title} nodes`} onClick={() => onFocusNodes(scene.nodeIds)}>
          <span>{scene.shotCount} {scene.shotCount === 1 ? 'shot' : 'shots'} · {scene.targetDurationSeconds}s</span>
          {scene.allocatedDurationSeconds !== undefined && <span>{scene.allocatedDurationSeconds}s allocated</span>}
          {secondaryMetric ? <span>{secondaryMetric}</span> : null}
        </button>
        <div className="outline-scene-actions" aria-label={`${scene.item.title} controls`}>
          <button
            type="button"
            className="layer-control"
            aria-label={`${scene.item.hidden ? 'Show' : 'Hide'} ${scene.item.title}`}
            disabled={proposalPreview}
            onClick={() => onToggleVisibility(scene.item.nodeId)}
          >
            {scene.item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            type="button"
            className="layer-control"
            aria-label={`${scene.item.locked ? 'Unlock' : 'Lock'} ${scene.item.title}`}
            disabled={proposalPreview}
            onClick={() => onToggleLock(scene.item.nodeId)}
          >
            {scene.item.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>
      </div>
    </div>

    {sceneExpanded ? (
      <div className="outline-scene-children">
        {scene.groups.map((group) => {
          const groupBranchId = `group:${scene.item.nodeId}:${group.id}`;
          const expanded = searchActive || !collapsedBranches.has(groupBranchId);
          const nodeIds = group.items.map((item) => item.nodeId);
          return (
            <section className="outline-group" key={groupBranchId} aria-labelledby={`outline-group-${scene.item.nodeId}-${group.id}`}>
              <div className="outline-group-row">
                <button
                  type="button"
                  className="outline-disclosure"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.label} in ${scene.item.title}`}
                  aria-expanded={expanded}
                  onClick={() => onToggleBranch(groupBranchId)}
                >
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button type="button" className="outline-group-main" id={`outline-group-${scene.item.nodeId}-${group.id}`} onClick={() => onFocusNodes(nodeIds)}>
                  {groupIcon(group.id)}
                  <span>{group.label}</span>
                  <span className="outline-count">{group.items.length}</span>
                </button>
              </div>
              {expanded ? (
                <ul className="outline-group-items" aria-label={`${group.label} in ${scene.item.title}`}>
                  {group.items.map((item) => (
                    <OutlineItemRow
                      key={item.nodeId}
                      item={item}
                      selected={selectedNodeId === item.nodeId}
                      proposalPreview={proposalPreview}
                      onSelectNode={onSelectNode}
                      onToggleVisibility={onToggleVisibility}
                      onToggleLock={onToggleLock}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        {!scene.groups.length ? (
          <div className="outline-scene-empty">
            <span>No shots or production elements yet.</span>
            <button
              type="button"
              aria-label={`Add shot or asset to ${scene.item.title}`}
              disabled={proposalPreview || scene.item.locked}
              onClick={() => onAddToScene(scene.item.nodeId)}
            >
              <Plus size={11} aria-hidden="true" /> Add shot or asset
            </button>
          </div>
        ) : null}
      </div>
    ) : null}
  </section>;
}

export function UnifiedProjectOutline(props: UnifiedProjectOutlineProps) {
  const {
    model,
    selectedNodeId,
    collapsedBranches,
    proposalPreview,
    searchActive,
    onToggleBranch,
    onSelectNode,
    onFocusNodes,
    onToggleVisibility,
    onToggleLock,
  } = props;
  const projectStatusId = useId();
  const projectExpanded = searchActive || !collapsedBranches.has('project');

  return (
    <nav
      className="project-outline"
      data-testid="project-outline"
      aria-label="Project outline"
      aria-describedby="layer-list-instructions"
    >
      {model.project ? (
        <div className={`outline-summary-row outline-project-row ${selectedNodeId === model.project.nodeId ? 'active' : ''}`}>
          <button
            type="button"
            className="outline-disclosure"
            aria-label={`${projectExpanded ? 'Collapse' : 'Expand'} project`}
            aria-expanded={projectExpanded}
            onClick={() => onToggleBranch('project')}
          >
            {projectExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button type="button" className="outline-summary-main" aria-label={model.project.title} aria-describedby={projectStatusId} aria-pressed={selectedNodeId === model.project.nodeId} onClick={(event) => onSelectNode(model.project!.nodeId, event.metaKey || event.ctrlKey)}>
            <Film size={13} aria-hidden="true" />
            <span>{model.project.title}</span>
            <span id={projectStatusId} className={statusClass(model.project)}>{model.project.statusLabel}</span>
          </button>
        </div>
      ) : null}

      {projectExpanded ? (
        <div className="outline-project-children">
          {model.scenes.map((scene) => (
            <SceneBranch
              key={scene.item.nodeId}
              {...props}
              scene={scene}
            />
          ))}
        </div>
      ) : null}

      {model.unassigned.length ? (
        <section className="outline-attention" aria-labelledby="outline-attention-title">
          <div className="outline-group-row">
            <span className="outline-disclosure" aria-hidden="true" />
            <button type="button" className="outline-group-main" id="outline-attention-title" onClick={() => onFocusNodes(model.unassigned.map((item) => item.nodeId))}>
              <AlertTriangle size={12} aria-hidden="true" />
              <span>Needs attention</span>
              <span className="outline-count">{model.unassigned.length}</span>
            </button>
          </div>
          <ul className="outline-group-items" aria-label="Items that need attention">
            {model.unassigned.map((item) => (
              <OutlineItemRow
                key={item.nodeId}
                item={item}
                selected={selectedNodeId === item.nodeId}
                proposalPreview={proposalPreview}
                onSelectNode={onSelectNode}
                onToggleVisibility={onToggleVisibility}
                onToggleLock={onToggleLock}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {!model.project && !model.scenes.length && !model.unassigned.length
        ? <p className="outline-empty">Add a Story or Scene to start the project outline.</p>
        : searchActive && model.visibleItemCount === 0
          ? <p className="outline-empty">No project items match.</p>
          : null}
    </nav>
  );
}
