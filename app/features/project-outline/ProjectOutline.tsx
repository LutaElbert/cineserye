import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  Lock,
  MapPin,
  Package,
  Sparkles,
  Unlock,
  UserRound,
} from 'lucide-react';
import type { CinemaOutlineGroupId, CinemaOutlineItem, CinemaOutlineModel } from './outline-model';

type OutlineBranchId = 'project' | 'scene' | CinemaOutlineGroupId;

type ProjectOutlineProps = {
  model: CinemaOutlineModel;
  selectedNodeId: string | null;
  expandedBranches: ReadonlySet<OutlineBranchId>;
  proposalPreview: boolean;
  searchActive: boolean;
  onToggleBranch: (id: OutlineBranchId) => void;
  onSelectNode: (id: string) => void;
  onFocusNodes: (ids: string[]) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
};

function groupIcon(id: CinemaOutlineGroupId) {
  if (id === 'planning') return <Bot size={12} />;
  if (id === 'characters') return <UserRound size={12} />;
  if (id === 'locations') return <MapPin size={12} />;
  if (id === 'shots') return <Clapperboard size={12} />;
  if (id === 'visual-elements') return <Sparkles size={12} />;
  return <Package size={12} />;
}

function itemGlyph(item: CinemaOutlineItem) {
  if (item.kind === 'agent-run') return 'AI';
  return item.kind.slice(0, 1).toUpperCase();
}

function compactMetric(item: CinemaOutlineItem) {
  if (item.kind === 'shot') return item.metricLabel.split(' · ')[0];
  if (item.kind === 'agent-run') return 'Complete';
  return '';
}

function OutlineItemRow({
  item,
  selected,
  proposalPreview,
  onSelectNode,
  onToggleVisibility,
  onToggleLock,
}: {
  item: CinemaOutlineItem;
  selected: boolean;
  proposalPreview: boolean;
  onSelectNode: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
}) {
  const metric = compactMetric(item);
  return (
    <li className="outline-item">
      <div className={`outline-item-row ${selected ? 'active' : ''} ${item.proposed ? 'proposed' : ''}`}>
        <button
          type="button"
          className="outline-item-main"
          data-layer-id={item.nodeId}
          aria-label={item.title}
          aria-pressed={selected}
          onClick={() => onSelectNode(item.nodeId)}
        >
          <span className={`cinema-layer-glyph kind-${item.kind}`} data-glyph={itemGlyph(item)} aria-hidden="true" />
          <span className="outline-item-name">{item.title}</span>
          {metric ? <span className="outline-item-metric">{metric}</span> : null}
          {item.proposed ? <span className="outline-draft-badge">Draft</span> : null}
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

export function ProjectOutline({
  model,
  selectedNodeId,
  expandedBranches,
  proposalPreview,
  searchActive,
  onToggleBranch,
  onSelectNode,
  onFocusNodes,
  onToggleVisibility,
  onToggleLock,
}: ProjectOutlineProps) {
  const isExpanded = (id: OutlineBranchId) => searchActive || expandedBranches.has(id);
  const sceneNodeIds = [model.scene.nodeId, ...model.groups.flatMap((group) => group.items.map((item) => item.nodeId))];

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
            aria-label={`${isExpanded('project') ? 'Collapse' : 'Expand'} project`}
            aria-expanded={isExpanded('project')}
            onClick={() => onToggleBranch('project')}
          >
            {isExpanded('project') ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button type="button" className="outline-summary-main" aria-label={model.project.title} onClick={() => onSelectNode(model.project!.nodeId)}>
            <Film size={13} aria-hidden="true" />
            <span>{model.project.title}</span>
          </button>
        </div>
      ) : null}

      {isExpanded('project') ? (
        <div className="outline-project-children">
          <div className={`outline-summary-row outline-scene-row ${selectedNodeId === model.scene.nodeId ? 'active' : ''}`}>
            <button
              type="button"
              className="outline-disclosure"
              aria-label={`${isExpanded('scene') ? 'Collapse' : 'Expand'} scene`}
              aria-expanded={isExpanded('scene')}
              onClick={() => onToggleBranch('scene')}
            >
              {isExpanded('scene') ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            <button type="button" className="outline-summary-main" aria-label={model.scene.title} onClick={() => onSelectNode(model.scene.nodeId)}>
              <Clapperboard size={13} aria-hidden="true" />
              <span>{model.scene.title}</span>
            </button>
            <button type="button" className="outline-scene-metrics" aria-label="Focus scene nodes" onClick={() => onFocusNodes(sceneNodeIds)}>
              <span>{model.shotCount} shots · {model.targetDurationSeconds}s</span>
              <span>{model.expectedCostLabel}</span>
            </button>
          </div>

          {isExpanded('scene') ? (
            <div className="outline-scene-children">
              {model.groups.map((group) => {
                const expanded = isExpanded(group.id);
                const nodeIds = group.items.map((item) => item.nodeId);
                return (
                  <section className="outline-group" key={group.id} aria-labelledby={`outline-group-${group.id}`}>
                    <div className="outline-group-row">
                      <button
                        type="button"
                        className="outline-disclosure"
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.label}`}
                        aria-expanded={expanded}
                        onClick={() => onToggleBranch(group.id)}
                      >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <button type="button" className="outline-group-main" id={`outline-group-${group.id}`} onClick={() => onFocusNodes(nodeIds)}>
                        {groupIcon(group.id)}
                        <span>{group.label}</span>
                        <span className="outline-count">{group.items.length}</span>
                      </button>
                    </div>
                    {expanded ? (
                      <ul className="outline-group-items" aria-label={`${group.label} nodes`}>
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
            </div>
          ) : null}
        </div>
      ) : null}
      {searchActive && model.visibleItemCount === 0 ? <p className="outline-empty">No production items match.</p> : null}
    </nav>
  );
}

export type { OutlineBranchId };
