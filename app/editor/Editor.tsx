'use client';

import { useFilmmakingNavigation, setSimplifiedPreview, workspaceNavigationEvent, type FilmmakingStage } from '../features/simplified-flow/navigation';
import { useWorkspaceCapabilities } from '../features/simplified-flow/useWorkspaceCapabilities';
import { capabilityLabels, capabilityStatusLabels, capabilityDescription } from '../features/story-development/workflow-capabilities';
import { FilmmakingNavigation, WorkspaceStatus, WorkspaceGuide, ShotsOverview } from '../features/simplified-flow/SimplifiedWorkspace';
import { ProjectOperationSummary } from '../features/simplified-flow/ProjectOperationSummary';
import { listClientOperations, observeClientOperation, reconcileProjectOperations, recordClientOperationIntent, subscribeClientOperations } from '../features/simplified-flow/operation-journal';
import { projectStageProjection, type StageAction } from '../features/simplified-flow/stage-projection';
import { SequenceReview } from '../features/assembly/SequenceReview';
import { CanvasBoundActionbar } from './CanvasBoundActionbar';

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  NodeResizer,
  NodeToolbar,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeProps,
  type OnBeforeDelete,
  type ResizeParams,
} from '@xyflow/react';
import {
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Focus,
  Hand,
  HardDrive,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Lock,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Unlock,
  Upload,
  Waypoints,
  X,
} from 'lucide-react';
import {
  createContext,
  Fragment,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import '@xyflow/react/dist/style.css';
import { useConfirmationDialog } from '../components/useConfirmationDialog';
import { LayerEditorShell } from './LayerEditorShell';
import { LayerEditorFields } from './LayerEditorFields';
import { StoryComposer as PremiseLayerEditor } from '../features/story-development/StoryComposer';
import { storyGenreTone } from '../domain/cinema/story-genres';
import { createStoryStarterDocument } from './story-starter';
import { ExpandedPremiseNode } from './ExpandedPremiseNode';
import { CanvasZoomGestures } from './CanvasZoomGestures';
import { InlineDiscardButton } from './InlineDiscardButton';
import { useStoryAssistant } from '../features/story-development/useStoryAssistant';
import { StoryAssistantLayer } from '../features/story-development/StoryAssistantLayer';
import { AssistantShotPlanning } from '../features/story-development/AssistantShotPlanning';
import { projectStoryAssistant, avoidAssistantOverlap } from './story-assistant-projection';
import { editLayerText, editLayerShot, layerEditTarget } from './layer-editing';
import { VisualPreproductionPanel } from '../features/storyboard/VisualPreproductionPanel';
import { ShotMediaPreview } from '../features/storyboard/ShotMediaPreview';
import { selectShotMediaPreview } from '../features/storyboard/shot-media-selection';
import {
  downloadProjectBackup,
  MAX_PROJECT_FILE_SIZE,
  parseProjectBackupWithMedia,
  serializeProjectBackupWithMedia,
} from './document-file';
import {
  applyCanvasCommandProposal,
  type AppliedCanvasCommandProposal,
  type CanvasCommandProposal,
} from './canvas-commands';
import { APP_CONFIG } from './config';
import { buildSvgDocument, downloadSvg } from './export-svg';
import { EDITOR_FEATURES } from './features';
import { collectMediaHashes } from './media-reachability';
import { storyReferenceMediaHashes, storyReviewSession } from '../domain/cinema/story-workflow';
import { useMediaRetentionLease } from './useMediaRetentionLease';
import { fileToDataUrl, validateImageFile } from './image-file';
import {
  canConnect,
  collapsedDescendantIds,
  connectionIssue,
  connectionIssueMessage,
  tidyGraphPositions,
} from './graph-rules';
import { initialDocument } from './initial-document';
import {
  CONCEPT_DEFAULT_WIDTH,
  CONCEPT_EDIT_MIN_HEIGHT,
  CONCEPT_EDIT_MIN_WIDTH,
  CONCEPT_MIN_HEIGHT,
  CONCEPT_MIN_WIDTH,
  editorNodeDimensions,
  relativeConceptLayout,
} from './node-layout';
import {
  cinemaHierarchyParentId,
  cinemaHierarchyRootId,
  planCinemaHierarchyLayout,
  resolveCinemaHierarchyInsertion,
} from './cinema-hierarchy';
import {
  planCinemaDraftInsertion,
  planCinemaWorkspaceReorganization,
  type CinemaConnectionDirection,
} from './cinema-workspace-placement';
import {
  CINEMA_HIERARCHY_BUS_EDGE_TYPE,
  planCinemaHierarchyBusRoutes,
} from './cinema-edge-routing';
import { CinemaHierarchyBusEdge } from './CinemaHierarchyBusEdge';
import {
  replaceLocalDocument,
  createLocalCheckpoint,
  deleteLocalCheckpoint,
  collectUnusedLocalMedia,
  localMediaPins,
  deletePendingCinemaProposal,
  listLocalCheckpoints,
  listLocalCinemaTraces,
  listLocalMediaBlobs,
  loadLocalDocument,
  loadLatestPendingCinemaProposal,
  loadLocalRecoveryDocument,
  savePendingCinemaProposal,
  saveLocalCinemaTrace,
  updatePendingCinemaProposal,
  saveLocalRecoveryDocument,
  saveLocalDocument,
  type LocalCheckpoint,
  type LocalCinemaTrace,
} from './persistence';
import {
  conceptTitleFromPlainText,
  emptyRichText,
  normalizeRichTextDocument,
  replaceRichTextPlainText,
  richTextIsEmpty,
  richTextToPlainText,
} from './rich-text';
import { RichTextView } from './RichTextView';
import type {
  ConversionOptions,
  EditorDocument,
  EditorEdge,
  EditorNode,
  RichTextDocument,
  VectorPathLayer,
} from './types';
import { vectorizeDataUrl } from './vectorize';
import {
  MOCK_CINEMA_PROJECT_DATA,
  MOCK_SHOT_PLAN_PROPOSAL,
  REEL_KNOWS_TOMORROW,
} from '../domain/cinema/mock/reel-knows-tomorrow';
import { cinemaProjectPresentation } from '../domain/cinema/project-presentation';
import type { CinemaProjectData } from '../domain/cinema/project-data';
import { StoryDevelopmentPanel } from '../features/story-development/StoryDevelopmentPanel';
import { ensureStoryProject, inheritedStoryDirection, storyPremise } from './story-development-commands';
import { cloneSnapshot, type EditorSnapshot } from './document-history';
import { DocumentController } from './document-controller';
import { editorFocusGeometry, type EditorFocusSpace } from './editor-focus';
import { useDocumentWriter } from './useDocumentWriter';
import { reviewStoryReferenceTransfer, type StoryReferenceOwner } from '../domain/cinema/story-workflow';
import {
  acceptCinemaPlanRevision,
  curateCinemaResearchSource,
  removeCinemaRecordsForNodes,
  type ResearchSourceCuration,
} from '../domain/cinema/project-data';
import {
  createEmptyVisualPreproductionData,
  type CinemaVisualPreproductionData,
} from '../domain/cinema/visual-preproduction';
import {
  cinemaProposalCanvasSource,
  compileCinemaCanvasProposal,
  layoutCinemaProposalNodes,
  prepareCinemaPlanProposal,
} from './cinema-plan-proposal';
import { cinemaSourceFingerprint, legacyCinemaSourceFingerprint } from './document-fingerprint';
import {
  applyCinemaDomainCommand,
  type CinemaDomainCommand,
  type CinemaShotPatch,
} from './cinema-domain-commands';
import { prepareCinemaRevisionRestore } from '../domain/cinema/revision-restore';
import type { CinemaProjectPresentation } from '../domain/cinema/prompt-artifacts';
import {
  UnifiedProjectOutline,
  type UnifiedOutlineBranchId,
} from '../features/project-outline/UnifiedProjectOutline';
import { buildUnifiedProjectOutline } from '../features/project-outline/unified-outline-model';
import { CinemaInspector } from '../features/scene-planner/CinemaInspector';
import {
  SceneBriefDialog,
  type SceneBriefDefaults,
} from '../features/scene-planner/SceneBriefDialog';
import type { ScenePlanningBrief } from '../domain/cinema/scene-brief';
import type {
  PlanSceneRequest,
  PlanSceneResponse,
} from '../features/scene-planner/plan-scene-api';
import { createCinemaConsentReceipt } from '../domain/cinema/live-consent';
import { FirstRunChooser } from '../features/onboarding/FirstRunChooser';
import { ProjectActionsMenu } from '../features/project-actions/ProjectActionsMenu';
import {
  CINEMA_DRAFT_DESCRIPTORS,
  cinemaDraftDescriptor,
  cinemaDraftRole,
  cinemaRelativeLabel,
  cinemaRelativeRole,
  nextCinemaDraftName,
  type CinemaDraftRole,
} from '../domain/cinema/manual-creation';
import { CinemaCreationPalette } from '../features/manual-creation/CinemaCreationPalette';
import { EmptyCanvasRecovery } from '../features/manual-creation/EmptyCanvasRecovery';
import {
  ProfessionalPlanningWorkspace,
  type ProfessionalWorkspaceView,
} from '../features/production/ProfessionalPlanningWorkspace';
import { ProjectProductionWorkspace } from '../features/project/ProjectProductionWorkspace';

type ToolMode = 'select' | 'hand';
type SelectionOperation = 'replace' | 'add' | 'subtract';
type MobilePanel = 'layers' | 'inspector' | null;
type EditorWorkspaceView = 'canvas' | 'project' | ProfessionalWorkspaceView;
type LayerPanelMode = 'outline' | 'layers';
type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };
const MAX_FILES_PER_IMPORT = 12;
const InlineConceptEditor = lazy(() => import('./InlineConceptEditor'));
const RESIZE_OBSERVER_NOTIFICATIONS = new Set([
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
]);

function runAfterCanvasLayout(action: () => void, attempt = 0) {
  const canvas = document.querySelector<HTMLElement>('.canvas-region .react-flow');
  const bounds = canvas?.getBoundingClientRect();
  if (bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height) && bounds.width > 0 && bounds.height > 0) {
    action();
    return;
  }
  if (attempt < 30) requestAnimationFrame(() => runAfterCanvasLayout(action, attempt + 1));
}

function installFrameScheduledResizeObserver() {
  if (typeof window === 'undefined' || typeof window.ResizeObserver === 'undefined') return;
  const resizeWindow = window as typeof window & { __canvasStarterFrameScheduledResizeObserver?: boolean };
  if (resizeWindow.__canvasStarterFrameScheduledResizeObserver) return;
  const NativeResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class FrameScheduledResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      let frameId: number | null = null;
      let pendingEntries: ResizeObserverEntry[] = [];
      super((entries, observer) => {
        pendingEntries = entries;
        if (frameId !== null) return;
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          const nextEntries = pendingEntries;
          pendingEntries = [];
          callback(nextEntries, observer);
        });
      });
    }
  };
  resizeWindow.__canvasStarterFrameScheduledResizeObserver = true;
}

installFrameScheduledResizeObserver();

type NodeActionContextValue = {
  convertingId: string | null;
  editingConceptId: string | null;
  keepImage: (id: string) => void;
  vectorizeImage: (id: string, expandLayers?: boolean) => void;
  cancelVectorization: () => void;
  recordResizeStart: (id: string) => void;
  recordResize: (id: string, dimensions: ResizeParams) => void;
  recordResizeEnd: (id: string, dimensions: ResizeParams) => void;
  beginConceptEdit: (id: string) => void;
  openLayerEditor: (id: string) => void;
  updateConceptTitle: (id: string, title: RichTextDocument) => void;
  updateConceptBody: (id: string, body: RichTextDocument) => void;
  commitConceptEdit: () => void;
  cancelConceptEdit: () => void;
  toggleBranch: (id: string) => void;
  hasChildren: (id: string) => boolean;
  addConceptRelative: (id: string, relation: 'child' | 'sibling') => void;
  openStory: () => void;
  storyReferenceCount: number;
  storyEnabled: boolean;
};

const NodeActionContext = createContext<NodeActionContextValue | null>(null);
const SelectedNodeCountContext = createContext(0);
const ProposedNodeIdsContext = createContext<ReadonlySet<string>>(new Set());
const CinemaProjectContext = createContext<CinemaProjectPresentation | null>(null);
const CinemaMediaContext = createContext<CinemaProjectData | null>(null);
const ExpandedStoryContext = createContext<{ nodeId: string; editor: ReactNode } | null>(null);
const StoryAssistantContext = createContext<ReactNode>(null);
function StoryAssistantNode() { return useContext(StoryAssistantContext); }

function useNodeActions() {
  const value = useContext(NodeActionContext);
  if (!value) throw new Error('Node actions are unavailable.');
  return value;
}

function CommonHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
    </>
  );
}

function ConceptNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  const proposedNodeIds = useContext(ProposedNodeIdsContext);
  const cinemaProject = useContext(CinemaProjectContext);
  const expandedStory = useContext(ExpandedStoryContext);
  const mediaProject = useContext(CinemaMediaContext);
  if (data.kind !== 'concept') return null;
  if (expandedStory?.nodeId === id) return <>{expandedStory.editor}<CommonHandles /></>;
  const editing = actions.editingConceptId === id;
  const singleSelection = selected && selectedNodeCount === 1;
  const cinemaDetail = cinemaProject?.nodes[id];
  const proposed = proposedNodeIds.has(id);
  const draftRole = cinemaDraftRole(data.domainType, data.eyebrow);
  const mediaShot = mediaProject && !proposed ? Object.values(mediaProject.shots).find((shot) => shot.nodeId === id) : undefined;
  const hasCurrentMedia = Boolean(mediaShot && mediaProject && selectShotMediaPreview(mediaProject, mediaShot).stage !== 'plan');
  return (
    <>
      <NodeToolbar isVisible={singleSelection && !editing && !data.locked} position={Position.Top} align="start" offset={14}>
        <CanvasBoundActionbar className="node-actionbar nodrag nowheel" aria-label="Concept actions">
          {['story', 'scene', 'shot'].includes(draftRole ?? '') && <button type="button" onClick={() => actions.openLayerEditor(id)}><TypeIcon size={14} /> Edit layer</button>}
          <button type="button" onClick={() => actions.beginConceptEdit(id)}><TypeIcon size={14} /> Edit text</button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'child')}><Plus size={14} /> {cinemaRelativeLabel(draftRole, 'child')}</button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'sibling')}><Plus size={14} /> {cinemaRelativeLabel(draftRole, 'sibling')}</button>
          {draftRole === 'story' && actions.storyEnabled && <button type="button" onClick={actions.openStory}>Develop / references ({actions.storyReferenceCount})</button>}
        </CanvasBoundActionbar>
      </NodeToolbar>
      <NodeResizer
        isVisible={singleSelection && !data.locked && !editing}
        minWidth={CONCEPT_MIN_WIDTH}
        minHeight={CONCEPT_MIN_HEIGHT}
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <article
        className={`concept-node tone-${data.tone} content-align-${data.horizontalAlign} content-valign-${data.verticalAlign} ${cinemaDetail ? `cinema-node cinema-${cinemaDetail.kind}` : ''} ${proposed ? 'is-proposed' : ''} ${editing ? 'is-editing nodrag nowheel' : ''}`}
        data-cinema-kind={cinemaDetail?.kind}
        data-domain-type={data.domainType}
        style={{ opacity: data.opacity }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (['story', 'scene', 'shot'].includes(draftRole ?? '')) actions.openLayerEditor(id);
          else if (!data.locked) actions.beginConceptEdit(id);
        }}
      >
        <span>{data.eyebrow}</span>
        {!cinemaDetail && draftRole ? <span className="cinema-draft-status">Draft</span> : null}
        {cinemaDetail ? (
          <span className={`cinema-node-status risk-${cinemaDetail.risk}`}>
            {proposed ? 'Proposed' : cinemaDetail.statusLabel}
          </span>
        ) : null}
        {editing ? (
          <Suspense fallback={<span className="editor-loading">Loading editor…</span>}>
            <InlineConceptEditor
              title={data.title}
              body={data.body}
              onTitleChange={(title) => actions.updateConceptTitle(id, title)}
              onBodyChange={(body) => actions.updateConceptBody(id, body)}
              onCommit={actions.commitConceptEdit}
              onCancel={actions.cancelConceptEdit}
            />
          </Suspense>
        ) : (
          <>
            {data.label
              ? <RichTextView document={data.title} className="concept-title-rich-text" />
              : <strong className="concept-title-placeholder">Untitled concept</strong>}
            {hasCurrentMedia && mediaProject && mediaShot ? <ShotMediaPreview cinema={mediaProject} shot={mediaShot} compact /> : <>
              {!richTextIsEmpty(data.body) ? <RichTextView document={data.body} /> : null}
              {cinemaDetail ? <small className="cinema-node-metric">{cinemaDetail.metricLabel}</small> : null}
            </>}
          </>
        )}
        {actions.hasChildren(id) ? (
          <button
            type="button"
            className="branch-toggle nodrag nowheel"
            aria-label={`${data.collapsed ? 'Expand' : 'Collapse'} branch from ${data.label}`}
            aria-expanded={!data.collapsed}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggleBranch(id);
            }}
          >
            {data.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : null}
      </article>
      <CommonHandles />
    </>
  );
}

function RasterNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  if (data.kind !== 'raster') return null;
  const isConverting = actions.convertingId === id;
  const singleSelection = selected && selectedNodeCount === 1;
  return (
    <>
      <NodeToolbar isVisible={singleSelection && !data.locked} position={Position.Top} offset={14}>
        <CanvasBoundActionbar className="node-actionbar nodrag nowheel" aria-label="Image actions">
          <button type="button" onClick={() => actions.keepImage(id)}>
            <Check size={14} /> Keep image
          </button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'child')}>
            <Plus size={14} /> Add child
          </button>
          <button type="button" onClick={() => actions.addConceptRelative(id, 'sibling')}>
            <Plus size={14} /> Add sibling
          </button>
          {EDITOR_FEATURES.imageVectorization ? (
            <>
              <button
                type="button"
                onClick={() => isConverting ? actions.cancelVectorization() : actions.vectorizeImage(id)}
              >
                {isConverting ? <X size={14} /> : <Shapes size={14} />}
                {isConverting ? 'Cancel' : 'Vectorize'}
              </button>
              <button
                type="button"
                onClick={() => actions.vectorizeImage(id, true)}
                disabled={isConverting}
              >
                <Layers3 size={14} /> Extract layers
              </button>
            </>
          ) : null}
        </CanvasBoundActionbar>
      </NodeToolbar>
      <NodeResizer
        isVisible={singleSelection && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <figure className="raster-node" style={{ opacity: data.opacity }}>
        {/* The user-provided image is the content of this editable layer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.src}
          alt=""
          width={data.naturalWidth}
          height={data.naturalHeight}
          draggable={false}
        />
        {isConverting ? (
          <figcaption className="conversion-overlay" role="status">
            <LoaderCircle className="spin" size={20} />
            Tracing locally…
          </figcaption>
        ) : null}
      </figure>
      <CommonHandles />
    </>
  );
}

function VectorNode({ id, data, selected }: NodeProps<EditorNode>) {
  const actions = useNodeActions();
  const selectedNodeCount = useContext(SelectedNodeCountContext);
  if (data.kind !== 'vector') return null;
  const [minX, minY, width, height] = data.viewBox;
  const singleSelection = selected && selectedNodeCount === 1;
  return (
    <>
      <NodeResizer
        isVisible={singleSelection && !data.locked}
        minWidth={120}
        minHeight={80}
        keepAspectRatio
        onResizeStart={() => actions.recordResizeStart(id)}
        onResize={(_, dimensions) => actions.recordResize(id, dimensions)}
        onResizeEnd={(_, dimensions) => actions.recordResizeEnd(id, dimensions)}
      />
      <div className="vector-node" style={{ opacity: data.opacity }}>
        <svg
          viewBox={`${minX} ${minY} ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${data.name}, ${data.paths.length} editable vector layers`}
        >
          {data.paths.map((path) =>
            path.visible ? (
              <path
                key={path.id}
                d={path.d}
                fill={path.fill}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                opacity={path.opacity}
              />
            ) : null,
          )}
        </svg>
        <span className="vector-badge">{data.paths.length} layers</span>
      </div>
      <CommonHandles />
    </>
  );
}

const nodeTypes = {
  storyAssistant: StoryAssistantNode,
  concept: ConceptNode,
  raster: RasterNode,
  vector: VectorNode,
};

const edgeTypes = {
  [CINEMA_HIERARCHY_BUS_EDGE_TYPE]: CinemaHierarchyBusEdge,
};

function withCinemaConnectionDirection(
  edge: EditorEdge,
  direction: CinemaConnectionDirection,
): EditorEdge {
  if (direction === 'vertical') {
    return { ...edge, sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep' };
  }
  const next = { ...edge, type: 'smoothstep' };
  delete next.sourceHandle;
  delete next.targetHandle;
  return next;
}

function layoutAppliedCinemaProposal(
  applied: AppliedCanvasCommandProposal,
  cinema: CinemaProjectData,
): AppliedCanvasCommandProposal {
  return {
    ...applied,
    document: {
      ...applied.document,
      nodes: layoutCinemaProposalNodes(applied.document.nodes, cinema),
    },
  };
}

function nodeDimensionSignature(nodes: EditorNode[]): string {
  return nodes.map((node) => {
    const dimensions = editorNodeDimensions(node);
    return `${node.id}:${Math.round(dimensions.width)}x${Math.round(dimensions.height)}`;
  }).join('|');
}

function restoreNodeGeometry(node: EditorNode, origin: EditorNode): EditorNode {
  const width = Number(origin.style?.width) || Number(origin.measured?.width);
  const height = Number(origin.style?.height) || Number(origin.measured?.height);
  return {
    ...node,
    position: structuredClone(origin.position),
    style: width && height
      ? { ...structuredClone(origin.style ?? {}), width, height }
      : origin.style ? structuredClone(origin.style) : undefined,
    measured: origin.measured ? structuredClone(origin.measured) : undefined,
  };
}

function safeFileBase(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || APP_CONFIG.export.defaultFileBase
  );
}

function formatCinemaMoney(value: number, currency: 'PHP' | 'USD') {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PHP' ? 0 : 2,
  }).format(value);
}

function formatCinemaCost(
  value: number | null,
  pricingMode: CinemaProjectPresentation['cost']['pricingMode'],
  currency: CinemaProjectPresentation['cost']['currency'],
) {
  if (value === null || pricingMode === 'unpriced') return 'Unpriced';
  if (pricingMode === 'credits') return `${value.toLocaleString('en-US')} credits`;
  return formatCinemaMoney(value, currency ?? 'USD');
}

function connectorPresentation(kind: 'default' | 'dashed' | 'emphasis') {
  return {
    stroke: kind === 'emphasis' ? '#635bff' : '#a9adb7',
    strokeWidth: kind === 'emphasis' ? 2.5 : 1.5,
    strokeDasharray: kind === 'dashed' ? '6 5' : undefined,
  };
}

function EditorInner() {
  const filmmaking = useFilmmakingNavigation();
  const [shotDetailOpen, setShotDetailOpen] = useState(false);
  const [simplifiedInspectorOpen, setSimplifiedInspectorOpen] = useState(false);
  const withMediaCleanupLease = useMediaRetentionLease();
  const { confirm: requestConfirmation, confirmationDialog } = useConfirmationDialog();
  const [documentController] = useState(() => new DocumentController(initialDocument, saveLocalDocument));
  const { nodes, edges, cinema, title, revision: autosaveRevision, replacing: replacingDocument } = useSyncExternalStore(
    documentController.subscribe, documentController.getSnapshot, documentController.getSnapshot,
  );
  const { setNodes, setEdges, setCinema, setTitle } = documentController;
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [temporaryPanActive, setTemporaryPanActive] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const workspaceCapabilities = useWorkspaceCapabilities(hydrated);
  const configuredProviderMode = workspaceCapabilities.value?.mode ?? 'loading';
  const configuredProviderStatus = workspaceCapabilities.value?.legacyPlanning ?? null;
  const capabilitySnapshot = useRef(workspaceCapabilities.value);
  useLayoutEffect(() => { capabilitySnapshot.current = workspaceCapabilities.value; }, [workspaceCapabilities.value]);
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const saveQueue = documentController.saves;
  const saveState = useSyncExternalStore(saveQueue.subscribe, saveQueue.getSnapshot, saveQueue.getSnapshot);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [expandedVectors, setExpandedVectors] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<{ nodeId: string; pathId: string } | null>(null);
  const [conversionOptions, setConversionOptions] = useState<ConversionOptions>({
    preset: 'balanced',
    colors: 16,
    despeckle: 1,
  });
  const history = documentController.history;
  const historyState = useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
  const [exportOpen, setExportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const writer = useDocumentWriter();
  useLayoutEffect(() => {
    documentController.setAdmission(writer === 'writer' && hydrated);
    return () => documentController.setAdmission(false, false);
  }, [documentController, writer, hydrated]);
  const [storyEnabled, setStoryEnabled] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch('/api/cinema/develop-story').then((response) => response.json()).then((value) => {
      if (active && typeof value === 'object' && value && 'enabled' in value) setStoryEnabled(value.enabled === true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [workspaceView, setWorkspaceView] = useState<EditorWorkspaceView>('canvas');
  const canvasVisible = workspaceView === 'canvas' && (!filmmaking.enabled
    || filmmaking.workspace === 'story' || filmmaking.workspace === 'shots' && shotDetailOpen);
  useEffect(() => {
    const restoreWorkspace = () => { setWorkspaceView('canvas'); setShotDetailOpen(false); };
    window.addEventListener('popstate', restoreWorkspace);
    window.addEventListener(workspaceNavigationEvent, restoreWorkspace);
    return () => {
      window.removeEventListener('popstate', restoreWorkspace);
      window.removeEventListener(workspaceNavigationEvent, restoreWorkspace);
    };
  }, []);
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [layerEditorId, setLayerEditorId] = useState<string | null>(null);
  const [assistantOpenEpoch, setAssistantOpenEpoch] = useState(0);
  const [expandedShotSetup, setExpandedShotSetup] = useState<string | null>(null);
  const [focusSpace, setFocusSpace] = useState<EditorFocusSpace>({ width: 1280, height: 900, top: 80, bottom: 80 });
  const layerFocus = useMemo(() => editorFocusGeometry(
    focusSpace,
    filmmaking.enabled && filmmaking.workspace === 'shots' ? 720 : 440,
    640,
  ), [focusSpace, filmmaking.enabled, filmmaking.workspace]);
  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>('.canvas-region .react-flow');
    if (!canvas) return;
    const toolbar = canvas.querySelector<HTMLElement>('.canvas-toolbar');
    const controls = canvas.querySelector<HTMLElement>('.react-flow__controls');
    const measure = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const top = toolbar ? Math.max(16, toolbar.getBoundingClientRect().bottom - bounds.top + 16) : 80;
      const bottom = controls ? Math.max(24, bounds.bottom - controls.getBoundingClientRect().top + 16) : 80;
      const next = { width: Math.round(bounds.width), height: Math.round(bounds.height), top: Math.round(top), bottom: Math.round(bottom) };
      setFocusSpace((current) => Object.keys(next).every((key) => current[key as keyof EditorFocusSpace] === next[key as keyof EditorFocusSpace]) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    if (toolbar) observer.observe(toolbar, { box: 'border-box' });
    if (controls) observer.observe(controls);
    measure();
    return () => observer.disconnect();
  }, [hydrated, layerEditorId, workspaceView]);
  const activeLayerEditorId = useRef<string | null>(null);
  const [layerEditorError, setLayerEditorError] = useState('');
  const [layerEditorCard, setLayerEditorCard] = useState<EditorNode | null>(null);
  const [layerReferencesOpen, setLayerReferencesOpen] = useState(false);
  const [layerReferenceOwner, setLayerReferenceOwner] = useState<StoryReferenceOwner>({ kind: 'story', id: '' });
  const expandedStoryId = layerEditorCard?.data.kind === 'concept'
    && cinemaDraftRole(layerEditorCard.data.domainType, layerEditorCard.data.eyebrow) === 'story' ? layerEditorId : null;
  const layerEditorOrigin = useRef<EditorDocument | null>(null);
  const layerEditRecorded = useRef(false);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layerPanelMode, setLayerPanelMode] = useState<LayerPanelMode>('outline');
  const [creationPaletteOpen, setCreationPaletteOpen] = useState(false);
  const [recoveryDocument, setRecoveryDocument] = useState<EditorDocument | null>(null);
  const [checkpoints, setCheckpoints] = useState<LocalCheckpoint[]>([]);
  const [mockProposalStage, setMockProposalStage] = useState<'idle' | 'planning' | 'ready'>('idle');
  const [mockProposalPreview, setMockProposalPreview] = useState<AppliedCanvasCommandProposal | null>(null);
  const [proposalCinema, setProposalCinema] = useState<CinemaProjectData | null>(null);
  const [proposalMode, setProposalMode] = useState<'fixture' | 'live' | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [localCinemaTraces, setLocalCinemaTraces] = useState<LocalCinemaTrace[]>([]);
  const [sceneBriefDefaults, setSceneBriefDefaults] = useState<SceneBriefDefaults | null>(null);
  const [previewSelectedNodeId, setPreviewSelectedNodeId] = useState<string | null>(null);
  const [collapsedOutlineBranches, setCollapsedOutlineBranches] = useState<Set<UnifiedOutlineBranchId>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const exportDialogRef = useRef<HTMLDialogElement>(null);
  const backupDialogRef = useRef<HTMLDialogElement>(null);
  const traceDialogRef = useRef<HTMLDialogElement>(null);
  // Read-only views into the controller, not independently synchronized copies.
  const nodesRef = useMemo(() => ({ get current() { return documentController.getSnapshot().nodes; } }), [documentController]);
  const edgesRef = useMemo(() => ({ get current() { return documentController.getSnapshot().edges; } }), [documentController]);
  const cinemaRef = useMemo(() => ({ get current() { return documentController.getSnapshot().cinema; } }), [documentController]);
  const titleRef = useMemo(() => ({ get current() { return documentController.getSnapshot().title; } }), [documentController]);
  const dragOriginRef = useRef<EditorSnapshot | null>(null);
  const resizeOriginRef = useRef<EditorSnapshot | null>(null);
  const fieldOriginRef = useRef<EditorSnapshot | null>(null);
  const conceptEditOriginRef = useRef<EditorSnapshot | null>(null);
  const layerSelectionAnchorRef = useRef<string | null>(null);
  const selectionOriginRef = useRef<Set<string>>(new Set());
  const selectionOperationRef = useRef<SelectionOperation>('replace');
  const dragDepthRef = useRef(0);
  const conversionControllerRef = useRef<AbortController | null>(null);
  const planningControllerRef = useRef<AbortController | null>(null);
  const proposalSourceFingerprintRef = useRef<string | null>(null);
  const previewLayoutSignatureRef = useRef('');
  const {
    screenToFlowPosition,
    fitView,
    getViewport,
    getNodes,
    setCenter,
    zoomIn,
    zoomOut,
    deleteElements,
  } = useReactFlow<EditorNode, EditorEdge>();
  const nodesInitialized = useNodesInitialized();
  const initialOverviewFramed = useRef(false);

  useEffect(() => {
    // React Flow can trigger these browser-generated notifications while its
    // NodeResizer and internal measurements settle. The resize still completes;
    // prevent dev overlays and error trackers from treating it as an app crash.
    const handleResizeObserverNotification = (event: ErrorEvent) => {
      if (!RESIZE_OBSERVER_NOTIFICATIONS.has(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('error', handleResizeObserverNotification, true);
    return () => window.removeEventListener('error', handleResizeObserverNotification, true);
  }, []);

  useEffect(() => () => {
    planningControllerRef.current?.abort('editor-unmounted');
  }, []);

  useEffect(() => {
    previewLayoutSignatureRef.current = '';
  }, [pendingProposalId]);

  useEffect(() => {
    if (!pendingProposalId || !proposalCinema) return;
    void updatePendingCinemaProposal(pendingProposalId, {
      cinema: proposalCinema,
      selectedNodeId: previewSelectedNodeId,
    });
  }, [pendingProposalId, previewSelectedNodeId, proposalCinema]);

  const announce = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    // Give heavy document replacements a painted frame before starting the
    // readable interval; otherwise add/remove updates can batch and no status
    // is ever exposed to sighted users or the live region.
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200,
    )));
  }, []);

  useEffect(() => {
    if (!hydrated || !cinema) return;
    try { reconcileProjectOperations(cinema); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Saved request recovery is unavailable.';
      window.setTimeout(() => announce(message, 'error'), 0);
    }
  }, [hydrated, cinema, announce]);

  const recordHistory = useCallback((snapshot?: EditorSnapshot) => {
    documentController.record(snapshot);
  }, [documentController]);

  const removeCinemaForNodeIds = useCallback((removedNodeIds: ReadonlySet<string>) => {
    if (!cinemaRef.current || !removedNodeIds.size) return;
    const remainingHostNodeIds = new Set(
      nodesRef.current.filter((node) => !removedNodeIds.has(node.id)).map((node) => node.id),
    );
    setCinema(removeCinemaRecordsForNodes(cinemaRef.current, removedNodeIds, remainingHostNodeIds));
  }, [cinemaRef, nodesRef, setCinema]);

  const moveHistory = useCallback((direction: 'undo' | 'redo') => {
    try {
      if (documentController.moveHistory(direction)) setSelectedPath(null);
    } catch (error) { announce((error as Error).message, 'error'); }
  }, [announce, documentController]);
  const undo = useCallback(() => moveHistory('undo'), [moveHistory]);
  const redo = useCallback(() => moveHistory('redo'), [moveHistory]);

  const getCurrentDocument = documentController.document;

  const queueDocumentSave = useCallback((document: EditorDocument, pendingTicket?: number) => {
    if (writer !== 'writer') return Promise.reject(new Error('This tab is read-only. Close the other editor and reload to edit.'));
    return documentController.save(document, pendingTicket);
  }, [writer, documentController]);

  const runMockScene = useCallback(async (
    brief: ScenePlanningBrief,
    liveProviderConsent: boolean,
  ) => {
    if (mockProposalStage !== 'idle' || mockProposalPreview) return;
    const capability = capabilitySnapshot.current;
    if (!capability || !capability.legacyPlanning.livePreflight.ready) {
      announce('Workspace planning availability is unknown or blocked. Refresh workspace status before planning.', 'error');
      return;
    }
    if (!nodesRef.current.some((node) => node.id === brief.sceneNodeId)) {
      announce('The selected scene is not available in this document.', 'error');
      return;
    }
    let sourceDocument: EditorDocument;
    try {
      const currentDocument = getCurrentDocument();
      sourceDocument = ensureStoryProject(currentDocument);
      // Establish and persist the local project owner before recording an
      // operation or crossing the request boundary. Provider responses may
      // carry their own project label, but cannot replace this local identity.
      if (sourceDocument !== currentDocument) documentController.commit(sourceDocument, false);
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The project could not be prepared for shot planning.', 'error');
      return;
    }
    setMockProposalStage('planning');
    setMobilePanel('inspector');
    announce('Generating a shot plan with the configured research and planning providers.');
    proposalSourceFingerprintRef.current = cinemaSourceFingerprint(sourceDocument);
    const controller = new AbortController();
    planningControllerRef.current = controller;
    let operationId = '', journalRecorded = false, dispatched = false;
    const projectId = sourceDocument.cinema!.projectId;
    const journalOwner = { projectId, kind: 'shot-plan' as const, scopeKey: brief.sceneNodeId };
    try {
      await queueDocumentSave(sourceDocument);
      controller.signal.throwIfAborted();
      if (capabilitySnapshot.current !== capability) throw new Error('Workspace status changed while saving. Review the current provider and estimate before planning.');
      const idempotencyKey = crypto.randomUUID(); operationId = idempotencyKey;
      recordClientOperationIntent({ id: idempotencyKey, ...journalOwner,
        sourceFingerprint: cinemaSourceFingerprint(sourceDocument),
        provider: configuredProviderStatus?.planning.provider ?? (configuredProviderMode === 'fixture' ? 'cineserye-shot-plan-fixture' : 'configured-shot-planning-provider'),
        model: configuredProviderStatus?.planning.model ?? null,
        estimateUsd: configuredProviderStatus?.livePreflight.maxLiveRunCost ?? (configuredProviderMode === 'fixture' ? 0 : null) });
      journalRecorded = true;
      observeClientOperation(idempotencyKey, journalOwner, { phase: 'dispatched', dispatchCertainty: 'may-have-dispatched' });
      dispatched = true;
      const response = await fetch('/api/cinema/plan-scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          idempotencyKey,
          brief,
          liveProviderConsent,
          liveConsentReceipt: liveProviderConsent
            && configuredProviderStatus?.livePreflight.maxLiveRunCost
            && configuredProviderStatus.planning.model
            ? createCinemaConsentReceipt(
              brief,
              configuredProviderStatus.livePreflight.maxLiveRunCost,
              new Date().toISOString(),
              configuredProviderStatus.planning.model,
            )
            : null,
        } satisfies PlanSceneRequest),
        signal: controller.signal,
      });
      const payload = await response.json() as PlanSceneResponse;
      controller.signal.throwIfAborted();
      if (!payload.ok) throw new Error(payload.error.message);
      const ownedCinema = { ...payload.cinema, projectId };
      const preparedProposal = prepareCinemaPlanProposal(sourceDocument, sourceDocument.cinema, payload.proposal, {
        replaceStarterShot: !sourceDocument.cinema?.activeRevisionId,
      });
      const preview = layoutAppliedCinemaProposal(
        applyCanvasCommandProposal(cinemaProposalCanvasSource(sourceDocument), preparedProposal),
        ownedCinema,
      );
      const selectedShotId = ownedCinema.scenes[brief.sceneNodeId]?.shotIds[2]
        ?? ownedCinema.scenes[brief.sceneNodeId]?.shotIds[0];
      const selectedShotNodeId = selectedShotId ? ownedCinema.shots[selectedShotId]?.nodeId ?? null : null;
      const pendingId = `${projectId}:${brief.sceneNodeId}:${payload.runId}`;
      const traceRecord = { id: payload.runId, createdAt: Date.now(), events: payload.trace };
      await saveLocalCinemaTrace(traceRecord);
      controller.signal.throwIfAborted();
      setLocalCinemaTraces((current) => [traceRecord, ...current.filter((entry) => entry.id !== traceRecord.id)].slice(0, 50));
      await savePendingCinemaProposal({
        id: pendingId,
        projectId,
        sceneId: brief.sceneNodeId,
        runId: payload.runId,
        sourceFingerprint: cinemaSourceFingerprint(sourceDocument),
        proposal: preparedProposal,
        cinema: ownedCinema,
        mode: payload.mode,
        warningSummary: payload.warnings,
        sourceCount: payload.sourceCount,
        selectedNodeId: selectedShotNodeId,
        readyAt: Date.now(),
      });
      if (controller.signal.aborted) {
        await deletePendingCinemaProposal(pendingId);
        controller.signal.throwIfAborted();
      }
      setPendingProposalId(pendingId);
      setProposalCinema(ownedCinema);
      setProposalMode(payload.mode);
      setMockProposalPreview(preview);
      setPreviewSelectedNodeId(selectedShotNodeId);
      setMockProposalStage('ready');
      observeClientOperation(operationId, journalOwner, { phase: 'awaiting-review', dispatchCertainty: 'completed', lastError: null,
        completedUnits: Object.keys(ownedCinema.shots).length, totalUnits: Object.keys(ownedCinema.shots).length });
      window.setTimeout(() => fitView({ duration: 340, padding: 0.14 }), 140);
      announce(
        `${payload.mode === 'live' ? 'Live' : 'Fixture'} shot plan ready for review: ${Object.keys(ownedCinema.shots).length} shots, reusable elements, ${payload.sourceCount} sources, and explicit cost assumptions.`,
        'success',
      );
    } catch (error) {
      if (planningControllerRef.current !== controller) return;
      if (journalRecorded) try { observeClientOperation(operationId, journalOwner, {
        phase: dispatched ? 'unknown' : 'failed', dispatchCertainty: dispatched ? 'may-have-dispatched' : 'not-dispatched',
        lastError: controller.signal.aborted ? 'Local tracking stopped. Provider work or billing may continue.' : error instanceof Error ? error.message : 'The proposal could not be prepared.',
      }); } catch { /* Preserve existing request state if the journal belongs to an older scope. */ }
      if (!controller.signal.aborted) {
        announce(error instanceof Error ? error.message : 'The proposal could not be prepared.', 'error');
      }
      setProposalCinema(null);
      setProposalMode(null);
      setMockProposalStage('idle');
    } finally {
      if (planningControllerRef.current === controller) planningControllerRef.current = null;
    }
  }, [announce, configuredProviderMode, configuredProviderStatus, documentController, fitView, getCurrentDocument, mockProposalPreview, mockProposalStage, nodesRef, queueDocumentSave]);

  const planMockScene = useCallback((requestedNodeId?: string) => {
    if (mockProposalStage !== 'idle' || mockProposalPreview || sceneBriefDefaults) return;
    if (configuredProviderMode === 'loading') {
      announce('Provider configuration is still loading. Try again in a moment.');
      return;
    }
    const selected = nodesRef.current.filter((node) => node.selected);
    const sceneNode = requestedNodeId ? nodesRef.current.find((node) => node.id === requestedNodeId) : selected.length === 1 ? selected[0] : null;
    if (
      !sceneNode
      || sceneNode.data.kind !== 'concept'
      || cinemaDraftRole(sceneNode.data.domainType, sceneNode.data.eyebrow) !== 'scene'
    ) {
      announce('Select exactly one scene before planning.', 'error');
      return;
    }
    const existing = cinemaRef.current?.scenes[sceneNode.id]?.brief;
    const direction = inheritedStoryDirection(getCurrentDocument(), sceneNode.id);
    if (!existing && direction && (direction.allocation < 6 || direction.allocation > 180)) {
      announce(`This scene is allocated ${direction.allocation}s. Current shot planning supports 6–180s; split or revise the allocation first.`, 'error');
      return;
    }
    const sceneText = richTextToPlainText(sceneNode.data.body).trim() || sceneNode.data.label.trim();
    setSceneBriefDefaults({
      version: 2,
      sceneNodeId: sceneNode.id,
      sceneText,
      creationMode: existing?.creationMode ?? 'ai-generated',
      aspectRatio: existing?.aspectRatio ?? direction?.brief.aspectRatio ?? '9:16',
      targetPlatform: existing?.targetPlatform ?? direction?.brief.platform ?? 'short-form',
      genreTone: existing?.genreTone ?? (direction ? storyGenreTone(direction.brief) : ''),
      locationPeriod: existing?.locationPeriod ?? (direction ? 'Use the setting in this scene; propose a consistent location and period if unspecified.' : ''),
      dialogueAudioIntent: existing?.dialogueAudioIntent ?? 'mixed',
      targetDurationSeconds: existing?.targetDurationSeconds ?? direction?.allocation ?? 36,
      requiredBeats: existing?.requiredBeats ?? [],
      mustInclude: existing?.mustInclude ?? direction?.brief.constraints ?? [],
      mustAvoid: existing?.mustAvoid ?? [],
      generationBudget: existing?.generationBudget ?? {
        pricingMode: 'unpriced',
        currency: null,
        ceiling: null,
        maxAttempts: 2,
      },
      productionConstraints: existing?.productionConstraints ?? {
        budgetBand: 'micro',
        currency: 'PHP',
        budgetCeiling: null,
        availableEquipment: [],
      },
    });
  }, [announce, cinemaRef, configuredProviderMode, getCurrentDocument, mockProposalPreview, mockProposalStage, nodesRef, sceneBriefDefaults]);

  const createPlanRevision = useCallback(() => {
    const sceneId = cinemaRef.current?.activeSceneId;
    const sceneNode = sceneId ? nodesRef.current.find((node) => node.id === cinemaRef.current?.scenes[sceneId]?.nodeId) : null;
    if (!sceneId || !sceneNode || sceneNode.data.kind !== 'concept') {
      announce('The accepted plan no longer has a valid scene host.', 'error');
      return;
    }
    const sceneRecord = cinemaRef.current?.scenes[sceneId];
    const existing = sceneRecord?.brief;
    const sceneText = sceneRecord?.synopsis.trim()
      || richTextToPlainText(sceneNode.data.body).trim()
      || sceneNode.data.label.trim();
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === sceneNode.id })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSceneBriefDefaults({
      version: 2,
      sceneNodeId: sceneNode.id,
      sceneText,
      creationMode: existing?.creationMode ?? 'ai-generated',
      aspectRatio: existing?.aspectRatio ?? '9:16',
      targetPlatform: existing?.targetPlatform ?? 'short-form',
      genreTone: existing?.genreTone ?? '',
      locationPeriod: existing?.locationPeriod ?? '',
      dialogueAudioIntent: existing?.dialogueAudioIntent ?? 'mixed',
      targetDurationSeconds: existing?.targetDurationSeconds ?? 36,
      requiredBeats: existing?.requiredBeats ?? [],
      mustInclude: existing?.mustInclude ?? [],
      mustAvoid: existing?.mustAvoid ?? [],
      generationBudget: existing?.generationBudget ?? {
        pricingMode: 'unpriced', currency: null, ceiling: null, maxAttempts: 2,
      },
      productionConstraints: existing?.productionConstraints ?? {
        budgetBand: 'micro', currency: 'PHP', budgetCeiling: null, availableEquipment: [],
      },
    });
  }, [announce, cinemaRef, nodesRef, setEdges, setNodes]);

  const closeSceneBrief = useCallback(() => {
    setSceneBriefDefaults(null);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>('.plan-scene-button')?.focus();
    });
  }, []);

  const rejectMockProposal = useCallback(() => {
    if (pendingProposalId) void deletePendingCinemaProposal(pendingProposalId);
    setMockProposalPreview(null);
    setMockProposalStage('idle');
    setPreviewSelectedNodeId(null);
    setProposalCinema(null);
    setProposalMode(null);
    setPendingProposalId(null);
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === REEL_KNOWS_TOMORROW.sceneNodeId })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    window.setTimeout(() => fitView({ duration: 280, padding: 0.22 }), 80);
    announce('Proposal rejected. The saved canvas was not changed.');
  }, [announce, fitView, pendingProposalId, setEdges, setNodes]);

  const curateProposalSource = useCallback((sourceId: string, action: ResearchSourceCuration) => {
    setProposalCinema((current) => {
      if (!current) return current;
      try {
        return curateCinemaResearchSource(current, sourceId, action);
      } catch (error) {
        announce(error instanceof Error ? error.message : 'The source could not be updated.', 'error');
        return current;
      }
    });
    const message = action.type === 'remove'
      ? 'Source removed from the proposal and its citation relationships.'
      : action.type === 'set-pinned'
        ? action.pinned ? 'Source pinned by the creator.' : 'Creator pin removed.'
        : `Source marked ${action.status.replace('-', ' ')}.`;
    announce(message, 'success');
  }, [announce]);

  const acceptMockProposal = useCallback(() => {
    if (!mockProposalPreview || !proposalCinema) return;
    if (proposalSourceFingerprintRef.current !== cinemaSourceFingerprint(getCurrentDocument())) {
      announce('The source canvas changed. Reject this stale proposal and review a new plan before accepting.', 'error');
      return;
    }
    const nextCinema = acceptCinemaPlanRevision(cinemaRef.current, proposalCinema, new Date().toISOString());
    const referencedNodeIds = new Set([
      ...(nextCinema.projectNodeId ? [nextCinema.projectNodeId] : []),
      ...Object.values(nextCinema.scenes).map((scene) => scene.nodeId),
      ...Object.values(nextCinema.shots).map((shot) => shot.nodeId),
      ...Object.values(nextCinema.characters).map((character) => character.nodeId),
      ...Object.values(nextCinema.assets).map((asset) => asset.nodeId),
      ...Object.values(nextCinema.agentRuns).map((run) => run.nodeId),
    ]);
    const orphanedProposalNodeIds = new Set(
      mockProposalPreview.affectedNodeIds.filter((nodeId) => !referencedNodeIds.has(nodeId)),
    );
    recordHistory();
    setNodes(mockProposalPreview.document.nodes
      .filter((node) => !orphanedProposalNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        selected: node.id === 'cine-shot-03',
      })));
    setEdges(mockProposalPreview.document.edges
      .filter((edge) => (
        !orphanedProposalNodeIds.has(edge.source)
        && !orphanedProposalNodeIds.has(edge.target)
      ))
      .map((edge) => ({ ...edge, selected: false })));
    setCinema(nextCinema);
    setMockProposalPreview(null);
    setMockProposalStage('idle');
    setPreviewSelectedNodeId(null);
    setProposalCinema(null);
    setProposalMode(null);
    if (pendingProposalId) void deletePendingCinemaProposal(pendingProposalId);
    setPendingProposalId(null);
    setSelectedPath(null);
    window.setTimeout(() => fitView({ duration: 340, padding: 0.14 }), 140);
    announce('Prompt package accepted as one undoable canvas change.', 'success');
  }, [announce, cinemaRef, fitView, getCurrentDocument, mockProposalPreview, pendingProposalId, proposalCinema, recordHistory, setCinema, setEdges, setNodes]);

  const restorePlanRevision = useCallback(async (revisionId: string) => {
    const current = cinemaRef.current;
    const revision = current?.revisions[revisionId];
    if (!current || !revision || revision.id === current.activeRevisionId) return;
    const nextNumber = Math.max(0, ...Object.values(current.revisions).map((item) => item.number)) + 1;
    const confirmed = await requestConfirmation({
      tone: 'warning',
      eyebrow: 'Plan history',
      title: `Restore Revision ${revision.number}?`,
      description: `Revision ${revision.number} will become new Revision ${nextNumber}.`,
      impact: 'The current plan will remain available in revision history.',
      reassurance: 'The restore is recorded as one undoable canvas change.',
      confirmLabel: `Restore as Revision ${nextNumber}`,
    });
    if (!confirmed) return;
    try {
      const restoredAt = new Date().toISOString();
      const restoreRunId = crypto.randomUUID();
      const restoredCinema = prepareCinemaRevisionRestore(current, revisionId, restoreRunId, restoredAt);
      const source = getCurrentDocument();
      const proposal = prepareCinemaPlanProposal(
        source,
        current,
        compileCinemaCanvasProposal(restoreRunId, restoredCinema),
      );
      const applied = layoutAppliedCinemaProposal(
        applyCanvasCommandProposal(cinemaProposalCanvasSource(source), proposal),
        restoredCinema,
      );
      const acceptedCinema = acceptCinemaPlanRevision(current, restoredCinema, restoredAt);
      const sceneNodeId = acceptedCinema.activeSceneId
        ? acceptedCinema.scenes[acceptedCinema.activeSceneId]?.nodeId
        : null;
      recordHistory();
      setNodes(applied.document.nodes.map((node) => ({ ...node, selected: node.id === sceneNodeId })));
      setEdges(applied.document.edges.map((edge) => ({ ...edge, selected: false })));
      setCinema(acceptedCinema);
      setSelectedPath(null);
      window.setTimeout(() => fitView({ duration: 340, padding: 0.14 }), 80);
      announce(`Revision ${revision.number} restored as new Revision ${nextNumber}.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The revision could not be restored.', 'error');
    }
  }, [announce, cinemaRef, fitView, getCurrentDocument, recordHistory, requestConfirmation, setCinema, setEdges, setNodes]);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadLocalDocument(),
      listLocalCheckpoints(),
      loadLocalRecoveryDocument(),
      loadLatestPendingCinemaProposal(),
      listLocalCinemaTraces(),
    ])
      .then(([document, storedCheckpoints, storedRecovery, pending, storedTraces]) => {
        if (!active) return;
        setCheckpoints(storedCheckpoints);
        setRecoveryDocument(storedRecovery);
        setLocalCinemaTraces(storedTraces.slice(0, 50));
        if (!document) {
          setFirstRunOpen(true);
          return;
        }
        const loadedNodes = document.cinema
          ? layoutCinemaProposalNodes(document.nodes, document.cinema)
          : document.nodes;
        documentController.hydrate({ ...document, nodes: loadedNodes.map((node) => ({ ...node, selected: false })),
          edges: document.edges.map((edge) => ({ ...edge, selected: false })) });
        if (pending) {
          if (pending.sourceFingerprint === cinemaSourceFingerprint(document)
            || pending.sourceFingerprint === legacyCinemaSourceFingerprint(document)) {
            proposalSourceFingerprintRef.current = pending.sourceFingerprint;
            const prepared = prepareCinemaPlanProposal(document, document.cinema, pending.proposal);
            const preview = layoutAppliedCinemaProposal(
              applyCanvasCommandProposal(cinemaProposalCanvasSource(document), prepared),
              pending.cinema,
            );
            setMockProposalPreview(preview);
            setProposalCinema(pending.cinema);
            setProposalMode(pending.mode);
            setPendingProposalId(pending.id);
            setPreviewSelectedNodeId(pending.selectedNodeId);
            setMockProposalStage('ready');
            announce('Recovered the pending shot plan without repeating provider calls.', 'success');
          } else {
            void deletePendingCinemaProposal(pending.id);
            announce('A stale pending shot plan was discarded because the source canvas changed.', 'error');
          }
        }
      })
      .catch(() => {
        if (!active) return;
        saveQueue.reportLoadFailure();
        announce('The saved local project could not be opened. Use a backup or start a new project.', 'error');
      })
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, [announce, saveQueue, documentController]);

  useEffect(() => {
    if (!hydrated || firstRunOpen || writer !== 'writer' || replacingDocument) return;
    // The document controller already invalidated older writes for changed content.
    // Allocate a ticket here only for the initial hydrated document.
    const ticket = saveQueue.ensureTicket();
    const saveTimeout = window.setTimeout(() => {
      void queueDocumentSave(getCurrentDocument(), ticket);
    }, 450);
    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [autosaveRevision, firstRunOpen, getCurrentDocument, hydrated, queueDocumentSave, writer, saveQueue, replacingDocument]);

  useEffect(() => {
    if (!hydrated || writer !== 'writer') return;
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') void queueDocumentSave(getCurrentDocument());
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => document.removeEventListener('visibilitychange', saveWhenHidden);
  }, [getCurrentDocument, hydrated, queueDocumentSave, writer]);

  useEffect(() => {
    if (exportOpen && !exportDialogRef.current?.open) exportDialogRef.current?.showModal();
    if (!exportOpen && exportDialogRef.current?.open) exportDialogRef.current.close();
  }, [exportOpen]);

  useEffect(() => {
    if (backupOpen && !backupDialogRef.current?.open) backupDialogRef.current?.showModal();
    if (!backupOpen && backupDialogRef.current?.open) backupDialogRef.current.close();
  }, [backupOpen]);

  useEffect(() => {
    if (traceOpen && !traceDialogRef.current?.open) traceDialogRef.current?.showModal();
    if (!traceOpen && traceDialogRef.current?.open) traceDialogRef.current.close();
  }, [traceOpen]);

  const handleBeforeDelete = useCallback<OnBeforeDelete<EditorNode, EditorEdge>>(async ({ nodes: deletingNodes, edges: deletingEdges }) => {
    if (mockProposalPreview) return false;
    const source = documentController.capture();
    const commitDeletion = () => {
      try {
        documentController.assertSource(source);
        documentController.deleteElements(deletingNodes.map(node => node.id), deletingEdges.map(edge => edge.id));
        setSelectedPath(null);
      } catch (error) { announce(error instanceof Error ? error.message : 'The deletion could not be applied.', 'error'); }
      // The controller owns this complete transaction. Suppress XYFlow's two
      // separate edge/node removal callbacks and their partial history origins.
      return false as const;
    };
    if (deletingNodes.length === 0) return commitDeletion();
    const deletingIds = new Set(deletingNodes.map((node) => node.id));
    const leavesCanvasEmpty = nodesRef.current.every((node) => deletingIds.has(node.id));
    if (!leavesCanvasEmpty) return commitDeletion();
    const layerLabel = deletingNodes.length === 1 ? 'layer' : 'layers';
    const confirmed = await requestConfirmation({
      tone: 'danger',
      eyebrow: 'Canvas deletion',
      title: 'Delete entire canvas?',
      description: `${deletingNodes.length} ${layerLabel} and their connected cinema data will be removed.`,
      impact: 'The current canvas will be empty after this action.',
      reassurance: 'You can undo immediately or recover the last non-empty canvas after reloading.',
      confirmLabel: `Delete ${deletingNodes.length} ${layerLabel}`,
    });
    if (!confirmed) return false;
    const recovery = getCurrentDocument();
    try {
      await saveLocalRecoveryDocument(recovery);
      setRecoveryDocument(recovery);
      announce('Recovery copy saved before the canvas was emptied.', 'success');
    } catch {
      announce('The recovery copy could not be saved. Undo remains available in this session.', 'error');
    }
    return commitDeletion();
  }, [announce, documentController, getCurrentDocument, mockProposalPreview, nodesRef, requestConfirmation]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<EditorNode>[]) => {
      // Expanded dimensions are view-only; never leak them into autosave/undo/layout data.
      const assistant = cinemaRef.current?.storyWorkflow?.assistant;
      const assistantMove = changes.find((change) => change.type === 'position' && change.id === assistant?.id);
      if (assistantMove?.type === 'position' && assistantMove.position && assistant && writer === 'writer'
        && toolMode === 'select' && !temporaryPanActive && !mockProposalPreview
        && !nodesRef.current.find((node) => node.id === assistant.premiseNodeId)?.data.locked) {
        const next = structuredClone(cinemaRef.current!);
        next.storyWorkflow!.assistant!.position = assistantMove.position;
        setCinema(next);
      }
      changes = changes.filter((change) => !('id' in change && (change.id === assistant?.id
        || change.id === layerEditorId && change.type === 'dimensions')));
      if (!changes.length) return;
      if (mockProposalPreview) {
        const selectedChange = [...changes].reverse().find((change) => change.type === 'select' && change.selected);
        if (selectedChange?.type === 'select') setPreviewSelectedNodeId(selectedChange.id);
        if (changes.some((change) => change.type === 'select' && !change.selected && change.id === previewSelectedNodeId)
          && !selectedChange) setPreviewSelectedNodeId(null);
        const dimensionChanges = changes.filter((change) => change.type === 'dimensions');
        if (dimensionChanges.length && proposalCinema) {
          setMockProposalPreview((current) => {
            if (!current) return current;
            const measuredNodes = applyNodeChanges(dimensionChanges, current.document.nodes);
            const signature = nodeDimensionSignature(measuredNodes);
            if (signature === previewLayoutSignatureRef.current) return current;
            previewLayoutSignatureRef.current = signature;
            return {
              ...current,
              document: {
                ...current.document,
                nodes: layoutCinemaProposalNodes(measuredNodes, proposalCinema),
              },
            };
          });
        }
        return;
      }
      const removedNodeIds = new Set(changes
        .filter((change): change is Extract<NodeChange<EditorNode>, { type: 'remove' }> => change.type === 'remove')
        .map((change) => change.id));
      if (removedNodeIds.size) {
        recordHistory();
        removeCinemaForNodeIds(removedNodeIds);
      }
      if (changes.every((change) => change.type === 'position')) {
        const changedNodes = applyNodeChanges(changes, nodesRef.current);
        setNodes(changedNodes);
      } else {
        // Selection is synchronous like every other controller read. The native
        // pointer capture below retains only gesture IDs before XYFlow resets it.
        setNodes((current) => applyNodeChanges(changes, current));
      }
      if (changes.some((change) => change.type === 'remove')) setSelectedPath(null);
    },
    [cinemaRef, writer, toolMode, temporaryPanActive, mockProposalPreview, nodesRef, setCinema, layerEditorId, proposalCinema, previewSelectedNodeId, recordHistory, removeCinemaForNodeIds, setNodes],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<EditorEdge>[]) => {
      changes = changes.filter((change) => !('id' in change && change.id === `${cinemaRef.current?.storyWorkflow?.assistant?.id}:association`));
      if (mockProposalPreview) return;
      if (changes.some((change) => change.type === 'remove')) recordHistory();
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [cinemaRef, mockProposalPreview, recordHistory, setEdges],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (mockProposalPreview) return;
      const issue = connectionIssue(nodesRef.current, edgesRef.current, connection);
      if (issue) {
        announce(connectionIssueMessage(issue), 'error');
        return;
      }
      recordHistory();
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: 'smoothstep',
            style: { stroke: '#a9adb7', strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed },
            label: '',
            data: { label: '', kind: 'default' },
          },
          current,
        ),
      );
    },
    [announce, edgesRef, mockProposalPreview, nodesRef, recordHistory, setEdges],
  );

  const handleReconnect = useCallback((edge: EditorEdge, connection: Connection) => {
    if (mockProposalPreview) return;
    const issue = connectionIssue(nodesRef.current, edgesRef.current, connection, edge.id);
    if (issue) {
      announce(connectionIssueMessage(issue), 'error');
      return;
    }
    recordHistory();
    setEdges((current) => reconnectEdge(edge, connection, current, { shouldReplaceId: false }));
  }, [announce, edgesRef, mockProposalPreview, nodesRef, recordHistory, setEdges]);

  const isValidConnection = useCallback(
    (connection: Connection | EditorEdge) => canConnect(nodesRef.current, edgesRef.current, connection),
    [edgesRef, nodesRef],
  );

  const selectNode = useCallback((id: string, additive = false) => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: additive ? node.id === id ? !node.selected : node.selected : node.id === id,
      })),
    );
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
  }, [setEdges, setNodes]);

  const revealAndSelectNode = useCallback((id: string, framing = { padding: 0.5, maxZoom: 1.4 }) => {
    const ancestors = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const target = queue.shift()!;
      for (const edge of edgesRef.current) {
        if (edge.target !== target || ancestors.has(edge.source)) continue;
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
    setNodes((current) => current.map((node) => ({
      ...node,
      selected: node.id === id,
      data: node.data.kind === 'concept' && ancestors.has(node.id)
        ? { ...node.data, collapsed: false }
        : node.data,
    })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    runAfterCanvasLayout(() => { void fitView({ nodes: [{ id }], duration: 280, ...framing }); });
  }, [edgesRef, fitView, setEdges, setNodes]);

  const ingestFiles = useCallback(
    async (files: File[], clientPoint?: { x: number; y: number }) => {
      if (files.length === 0) {
        announce('Use a PNG, JPEG, or WebP image.', 'error');
        return;
      }
      if (files.length > MAX_FILES_PER_IMPORT) {
        announce(`Add up to ${MAX_FILES_PER_IMPORT} images at a time.`, 'error');
        return;
      }

      try {
        const imageFiles = await Promise.all(
          files.map(async (file) => ({ file, dimensions: await validateImageFile(file) })),
        );
        const fallbackPoint = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const dropPoint = clientPoint
          ? screenToFlowPosition(clientPoint)
          : fallbackPoint;
        const imported: EditorNode[] = [];

        for (const [index, item] of imageFiles.entries()) {
          const { file, dimensions } = item;
          const src = await fileToDataUrl(file);
          const scale = Math.min(1, 430 / dimensions.width, 310 / dimensions.height);
          const width = Math.max(120, Math.round(dimensions.width * scale));
          const height = Math.max(80, Math.round(dimensions.height * scale));
          imported.push({
            id: crypto.randomUUID(),
            type: 'raster',
            position: {
              x: dropPoint.x - width / 2 + index * 28,
              y: dropPoint.y - height / 2 + index * 28,
            },
            style: { width, height },
            draggable: true,
            deletable: true,
            data: {
              kind: 'raster',
              name: file.name,
              fileName: file.name,
              src,
              naturalWidth: dimensions.width,
              naturalHeight: dimensions.height,
              opacity: 1,
              locked: false,
            },
            selected: index === imageFiles.length - 1,
          });
        }

        recordHistory();
        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          ...imported,
        ]);
        announce(
          `${imported.length === 1 ? imported[0].data.name : `${imported.length} images`} added to the canvas.`,
          'success',
        );
      } catch (error) {
        announce(error instanceof Error ? error.message : 'The image could not be added.', 'error');
      }
    },
    [announce, recordHistory, screenToFlowPosition, setNodes],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!canvasVisible) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"], dialog[open], .premise-expanded-node, .story-assistant-node, .layer-editor-shell')) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.some((file) => file.type.startsWith('image/'))) {
        event.preventDefault();
        void ingestFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [canvasVisible, ingestFiles]);

  const selectAllVisibleLayers = useCallback(() => {
    const collapsed = collapsedDescendantIds(nodesRef.current, edgesRef.current);
    const selectableIds = new Set(
      nodesRef.current
        .filter((node) => !node.hidden && !node.data.locked && !collapsed.has(node.id))
        .map((node) => node.id),
    );
    setNodes((current) => current.map((node) => ({
      ...node,
      selected: selectableIds.has(node.id),
    })));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    layerSelectionAnchorRef.current = selectableIds.values().next().value ?? null;
    announce(
      selectableIds.size
        ? `${selectableIds.size} ${selectableIds.size === 1 ? 'layer' : 'layers'} selected.`
        : 'There are no visible unlocked layers to select.',
    );
  }, [announce, edgesRef, nodesRef, setEdges, setNodes]);

  const clearCanvasSelection = useCallback(() => {
    setNodes((current) => current.map((node) => node.selected ? { ...node, selected: false } : node));
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    setSelectedPath(null);
    layerSelectionAnchorRef.current = null;
  }, [setEdges, setNodes]);

  const handleSelectionStart = useCallback((event: ReactMouseEvent) => {
    selectionOperationRef.current = event.altKey
      ? 'subtract'
      : event.shiftKey
        ? 'add'
        : 'replace';
    setSelectedPath(null);
  }, []);

  const handleSelectionEnd = useCallback(() => {
    const origin = selectionOriginRef.current;
    const operation = selectionOperationRef.current;
    setNodes((current) => {
      const marqueeIds = new Set(current.filter((node) => node.selected).map((node) => node.id));
      return current.map((node) => ({
        ...node,
        selected: operation === 'replace'
          ? marqueeIds.has(node.id) && !node.data.locked
          : operation === 'add'
            ? origin.has(node.id) || (marqueeIds.has(node.id) && !node.data.locked)
            : origin.has(node.id) && !(marqueeIds.has(node.id) && !node.data.locked),
      }));
    });
    setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
    layerSelectionAnchorRef.current = null;
    selectionOriginRef.current = new Set();
    selectionOperationRef.current = 'replace';
  }, [setEdges, setNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
      const isInteractive = Boolean(target?.closest('input, textarea, select, button, a[href], [contenteditable="true"]'));
      if (target?.closest('dialog[open], .premise-expanded-node, .story-assistant-node, .layer-editor-shell')) return;

      if (canvasVisible && !isInteractive && event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setTemporaryPanActive(true);
        return;
      }

      if (event.defaultPrevented) return;

      // Some browsers map Backspace outside an input to history navigation.
      // Neither a hidden selection nor the active workspace should change.
      if (!canvasVisible && !isEditing && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        return;
      }

      if (!isEditing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!canvasVisible) {
        return;
      } else if (!isEditing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAllVisibleLayers();
      } else if (!isEditing && event.key === 'Escape') {
        clearCanvasSelection();
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'h') {
        setToolMode('hand');
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        void zoomIn({ duration: 140 });
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key === '-') {
        event.preventDefault();
        void zoomOut({ duration: 140 });
      } else if (!isEditing && !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '0' || event.key === 'Home')) {
        event.preventDefault();
        void fitView({ duration: 220, padding: 0.22 });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setTemporaryPanActive(false);
    };
    const onWindowBlur = () => setTemporaryPanActive(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [canvasVisible, clearCanvasSelection, fitView, redo, selectAllVisibleLayers, undo, zoomIn, zoomOut]);

  useEffect(
    () => () => conversionControllerRef.current?.abort(),
    [],
  );

  const keepImage = useCallback((id: string) => {
    void id;
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setSelectedPath(null);
    announce('Image kept as an editable reference layer.', 'success');
  }, [announce, setNodes]);

  const vectorizeImage = useCallback(
    async (id: string, expandLayers = false) => {
      if (!EDITOR_FEATURES.imageVectorization) {
        announce('Image vectorization is currently unavailable.');
        return;
      }
      const raster = nodesRef.current.find((node) => node.id === id);
      if (!raster || raster.data.kind !== 'raster' || convertingId) return;
      const controller = new AbortController();
      conversionControllerRef.current = controller;
      setConvertingId(id);
      announce('Vectorization started locally. Your image is not being uploaded.');
      try {
        const result = await vectorizeDataUrl(
          raster.data.src,
          conversionOptions,
          controller.signal,
        );
        const rasterWidth = Number(raster.style?.width) || 320;
        const rasterHeight = Number(raster.style?.height) || 240;
        const vectorNode: EditorNode = {
          id: crypto.randomUUID(),
          type: 'vector',
          position: {
            x: raster.position.x + rasterWidth + 80,
            y: raster.position.y,
          },
          style: { width: rasterWidth, height: rasterHeight },
          draggable: true,
          deletable: true,
          data: {
            kind: 'vector',
            name: `${raster.data.name} vector`,
            sourceName: raster.data.name,
            viewBox: result.viewBox,
            paths: result.paths,
            opacity: 1,
            locked: false,
          },
          selected: true,
        };
        recordHistory();
        setNodes((current) => [
          ...current.map((node) => ({
            ...node,
            selected: false,
            data:
              node.id === id
                ? { ...node.data, opacity: expandLayers ? 0.32 : node.data.opacity }
                : node.data,
          })),
          vectorNode,
        ]);
        if (expandLayers) {
          setExpandedVectors((current) => new Set(current).add(vectorNode.id));
          setSelectedPath({ nodeId: vectorNode.id, pathId: result.paths[0].id });
        }
        window.setTimeout(() => fitView({ nodes: [{ id }, { id: vectorNode.id }], duration: 360, padding: 0.22 }), 60);
        announce(`Created ${result.paths.length} editable vector layers.`, 'success');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          announce('Vectorization cancelled.');
        } else {
          announce(error instanceof Error ? error.message : 'Vectorization failed.', 'error');
        }
      } finally {
        conversionControllerRef.current = null;
        setConvertingId(null);
      }
    },
    [announce, conversionOptions, convertingId, fitView, nodesRef, recordHistory, setNodes],
  );

  const cancelVectorization = useCallback(() => {
    conversionControllerRef.current?.abort();
  }, []);

  const previewNodeIds = useMemo(
    () => new Set(mockProposalPreview?.affectedNodeIds ?? []),
    [mockProposalPreview],
  );
  const presentedNodes = useMemo(
    () => mockProposalPreview
      ? mockProposalPreview.document.nodes.map((node) => ({
          ...node,
          selected: node.id === previewSelectedNodeId,
        }))
      : nodes,
    [mockProposalPreview, nodes, previewSelectedNodeId],
  );
  const presentedEdges = mockProposalPreview?.document.edges ?? edges;
  const mockPlanAccepted = Boolean(cinema?.activeRevisionId)
    || Object.values(cinema?.agentRuns ?? {}).some((run) => run.status === 'accepted');
  const cinemaOutlineActive = Boolean(mockProposalPreview || mockPlanAccepted);
  const activeCinemaData = mockProposalPreview ? proposalCinema : cinema;
  const activeCinemaProject = useMemo(
    () => activeCinemaData
      ? cinemaProjectPresentation(activeCinemaData)
      : REEL_KNOWS_TOMORROW,
    [activeCinemaData],
  );
  const cinemaNodeIds = useMemo(
    () => mockProposalPreview || mockPlanAccepted
      ? new Set(Object.keys(activeCinemaProject.nodes))
      : new Set<string>(),
    [activeCinemaProject.nodes, mockPlanAccepted, mockProposalPreview],
  );
  const selectedNodes = presentedNodes.filter((node) => node.selected);
  const selectedNode = selectedNodes[0] ?? null;
  const selectedNodeId = selectedNode?.id ?? null;
  const selectedNodeCount = selectedNodes.length;
  const commitStoryDocument = useCallback((next: EditorDocument, history = true) => {
    if (writer !== 'writer' || mockProposalPreview || editingConceptId) throw Error('Finish canvas editing or the shot-plan review before changing story data.');
    documentController.commit(next, history);
  }, [writer, mockProposalPreview, editingConceptId, documentController]);
  const selectedUnlockedCount = selectedNodes.filter((node) => !node.data.locked).length;
  const selectedEdge = mockProposalPreview ? null : edges.find((edge) => edge.selected) ?? null;
  const selectedCinemaDetail = selectedNode && activeCinemaData
    ? activeCinemaProject.nodes[selectedNode.id] ?? null
    : null;
  const selectedAcceptedShot = selectedNode && cinema
    ? Object.values(cinema.shots).find((shot) => shot.nodeId === selectedNode.id) ?? null
    : null;
  const revisionHistory = useMemo(
    () => Object.values(cinema?.revisions ?? {}).sort((left, right) => right.number - left.number),
    [cinema],
  );
  const selectedVectorPath = useMemo(() => {
    if (!selectedPath) return null;
    const node = nodes.find((item) => item.id === selectedPath.nodeId);
    if (!node || node.data.kind !== 'vector') return null;
    const path = node.data.paths.find((item) => item.id === selectedPath.pathId);
    return path ? { node, path } : null;
  }, [nodes, selectedPath]);

  const updateNode = useCallback(
    (id: string, updater: (node: EditorNode) => EditorNode, shouldRecord = true) => {
      if (shouldRecord) recordHistory();
      setNodes((current) => current.map((node) => (node.id === id ? updater(node) : node)));
    },
    [recordHistory, setNodes],
  );

  const updateEdge = useCallback(
    (id: string, updater: (edge: EditorEdge) => EditorEdge, shouldRecord = true) => {
      if (shouldRecord) recordHistory();
      setEdges((current) => current.map((edge) => edge.id === id ? updater(edge) : edge));
    },
    [recordHistory, setEdges],
  );

  const updateAcceptedShot = useCallback((
    shotId: string,
    patch: CinemaShotPatch,
  ) => {
    try {
      const updated = applyCinemaDomainCommand(getCurrentDocument(), { type: 'update-shot', shotId, patch });
      const shotNodeId = updated.cinema?.shots[shotId]?.nodeId;
      recordHistory();
      setNodes(updated.nodes.map((node) => ({ ...node, selected: node.id === shotNodeId })));
      setEdges(updated.edges);
      setCinema(updated.cinema);
      announce('Accepted shot updated. Its generated prompts are now marked stale.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The shot could not be updated.', 'error');
    }
  }, [announce, getCurrentDocument, recordHistory, setCinema, setEdges, setNodes]);

  const applyProfessionalPlanningCommand = useCallback((
    command: CinemaDomainCommand,
    successMessage: string,
  ) => {
    try {
      const updated = applyCinemaDomainCommand(getCurrentDocument(), command);
      recordHistory();
      setNodes(updated.nodes);
      setEdges(updated.edges);
      setCinema(updated.cinema);
      announce(successMessage, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The production plan could not be updated.', 'error');
    }
  }, [announce, getCurrentDocument, recordHistory, setCinema, setEdges, setNodes]);

  const selectProfessionalShot = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
    setMobilePanel('inspector');
  }, [setNodes]);

  const openProjectScene = useCallback((sceneId: string) => {
    try {
      const updated = applyCinemaDomainCommand(getCurrentDocument(), { type: 'set-active-scene', sceneId });
      const nodeId = updated.cinema?.scenes[sceneId]?.nodeId;
      recordHistory();
      setNodes(updated.nodes.map((node) => ({ ...node, selected: node.id === nodeId })));
      setEdges(updated.edges.map((edge) => ({ ...edge, selected: false })));
      setCinema(updated.cinema);
      setWorkspaceView('canvas');
      setSelectedPath(null);
      window.setTimeout(() => nodeId && fitView({ nodes: [{ id: nodeId }], duration: 260, padding: 0.7, maxZoom: 1.35 }), 60);
      announce('Scene opened on the canvas. Review its text, then generate its independent shot plan.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The scene could not be opened.', 'error');
    }
  }, [announce, fitView, getCurrentDocument, recordHistory, setCinema, setEdges, setNodes]);

  const visualOwnerEpoch = documentController.capture().epoch;
  const visualOwnerProjectId = cinema?.projectId;
  const updateVisualPreproduction = useCallback((
    updater: (current: CinemaVisualPreproductionData) => CinemaVisualPreproductionData,
  ) => {
    const applyVisual = (current: CinemaProjectData) => {
      const visualPreproduction = updater(current.visualPreproduction ?? createEmptyVisualPreproductionData());
      if (visualPreproduction === current.visualPreproduction) return current;
      if (visualPreproduction.references === current.visualPreproduction?.references) return { ...current, visualPreproduction };
      const prompts = structuredClone(current.prompts);
      for (const shot of Object.values(current.shots)) {
        const referenceIds = Object.values(visualPreproduction.references)
          .filter((reference) => reference.shotIds.includes(shot.id))
          .map((reference) => reference.id);
        for (const prompt of Object.values(prompts)) {
          if (prompt.ownerNodeId === shot.nodeId && (prompt.purpose === 'storyboard' || prompt.purpose === 'video')) {
            prompt.referenceIds = referenceIds;
          }
        }
      }
      return { ...current, prompts, visualPreproduction };
    };
    if (mockProposalPreview) {
      setProposalCinema((current) => current ? applyVisual(current) : current);
      return;
    }
    if (!documentController.ownsProject(visualOwnerEpoch, visualOwnerProjectId)) return;
    const current = cinemaRef.current;
    if (!current) return;
    const next = applyVisual(current);
    if (next === current) return;
    recordHistory();
    setCinema(next);
  }, [cinemaRef, documentController, mockProposalPreview, recordHistory, setCinema, visualOwnerEpoch, visualOwnerProjectId]);

  const cleanupUnusedMedia = useCallback(async () => {
    try {
      const memoryRoots = () => [getCurrentDocument(), ...history.roots(),
        dragOriginRef.current, resizeOriginRef.current, fieldOriginRef.current, conceptEditOriginRef.current,
        { cinema: proposalCinema }, mockProposalPreview?.document];
      const documents = [...memoryRoots(), await loadLocalRecoveryDocument(),
        ...(await listLocalCheckpoints()).map((checkpoint) => checkpoint.document),
        await loadLatestPendingCinemaProposal()];
      const used = collectMediaHashes(documents);
      const unused = (await listLocalMediaBlobs()).filter((entry) => !used.has(entry.hash) && !localMediaPins().has(entry.hash));
      if (!unused.length) {
        announce('No unused local media was found.');
        return;
      }
      const itemLabel = unused.length === 1 ? 'item' : 'items';
      const confirmed = await requestConfirmation({
        tone: 'danger',
        eyebrow: 'Local storage cleanup',
        title: 'Delete unused local media?',
        description: `${unused.length} unused local media ${itemLabel} will be permanently removed from this device.`,
        impact: 'Current work, undo history, recovery, pending proposals, and checkpoints are protected.',
        reassurance: 'This cleanup cannot be undone.',
        confirmLabel: `Delete ${unused.length} ${itemLabel}`,
      });
      if (!confirmed) return;
      const count = await withMediaCleanupLease(() => collectUnusedLocalMedia(unused.map((entry) => entry.hash), memoryRoots));
      announce(`${count} unused local media ${count === 1 ? 'item' : 'items'} deleted.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Unused local media could not be cleaned.', 'error');
    }
  }, [announce, getCurrentDocument, requestConfirmation, proposalCinema, mockProposalPreview, withMediaCleanupLease, history]);

  const updateSelectedNodes = useCallback((updater: (node: EditorNode) => EditorNode) => {
    const selectedIds = new Set(nodesRef.current.filter((node) => node.selected && !node.data.locked).map((node) => node.id));
    if (!selectedIds.size) return;
    recordHistory();
    setNodes((current) => current.map((node) => selectedIds.has(node.id) ? updater(node) : node));
  }, [nodesRef, recordHistory, setNodes]);

  const duplicateSelectedNodes = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (!selected.length) return;
    const idMap = new Map(selected.map((node) => [node.id, crypto.randomUUID()]));
    const copies = selected.map((node): EditorNode => ({
      ...structuredClone(node),
      id: idMap.get(node.id)!,
      position: { x: node.position.x + 28, y: node.position.y + 28 },
      selected: true,
      draggable: true,
      deletable: true,
      data: {
        ...structuredClone(node.data),
        name: `${node.data.name} copy`,
        locked: false,
      },
    }));
    const copiedEdges = edgesRef.current
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge): EditorEdge => ({
        ...structuredClone(edge),
        id: crypto.randomUUID(),
        source: idMap.get(edge.source)!,
        target: idMap.get(edge.target)!,
        selected: false,
      }));
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...copies,
    ]);
    setEdges((current) => [
      ...current.map((edge) => edge.selected ? { ...edge, selected: false } : edge),
      ...copiedEdges,
    ]);
    layerSelectionAnchorRef.current = copies[0]?.id ?? null;
    announce(`${copies.length} ${copies.length === 1 ? 'layer' : 'layers'} duplicated.`, 'success');
  }, [announce, edgesRef, nodesRef, recordHistory, setEdges, setNodes]);

  const setSelectedNodesLocked = useCallback((locked: boolean) => {
    const selectedIds = new Set(nodesRef.current.filter((node) => node.selected && node.data.locked !== locked).map((node) => node.id));
    if (!selectedIds.size) return;
    recordHistory();
    setNodes((current) => current.map((node) => selectedIds.has(node.id) ? {
      ...node,
      draggable: !locked,
      deletable: !locked,
      data: { ...node.data, locked },
    } : node));
  }, [nodesRef, recordHistory, setNodes]);

  const alignSelectedNodes = useCallback((mode: 'left' | 'top' | 'horizontal' | 'vertical') => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (selected.length < 2) return;
    if ((mode === 'horizontal' || mode === 'vertical') && selected.length < 3) return;
    recordHistory();
    if (mode === 'left' || mode === 'top') {
      const target = mode === 'left'
        ? Math.min(...selected.map((node) => node.position.x))
        : Math.min(...selected.map((node) => node.position.y));
      const ids = new Set(selected.map((node) => node.id));
      setNodes((current) => current.map((node) => ids.has(node.id)
        ? { ...node, position: { ...node.position, [mode === 'left' ? 'x' : 'y']: target } }
        : node));
      return;
    }
    const axis = mode === 'horizontal' ? 'x' : 'y';
    const sorted = [...selected].sort((a, b) => a.position[axis] - b.position[axis]);
    const start = sorted[0].position[axis];
    const end = sorted.at(-1)!.position[axis];
    const positions = new Map(sorted.map((node, index) => [node.id, start + ((end - start) * index) / (sorted.length - 1)]));
    setNodes((current) => current.map((node) => positions.has(node.id)
      ? { ...node, position: { ...node.position, [axis]: positions.get(node.id)! } }
      : node));
  }, [nodesRef, recordHistory, setNodes]);

  const deleteSelectedNodes = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected && !node.data.locked);
    if (!selected.length) return;
    void deleteElements({ nodes: selected });
  }, [deleteElements, nodesRef]);

  const tidyDiagram = useCallback(() => {
    const cinemaLayout = planCinemaWorkspaceReorganization(
      nodesRef.current,
      edgesRef.current,
      cinemaRef.current,
    );
    const positions = cinemaLayout.handled
      ? cinemaLayout.positions
      : tidyGraphPositions(nodesRef.current, edgesRef.current);
    if (!positions.size && !cinemaLayout.edgeDirections.size) {
      announce(cinemaLayout.handled ? 'Project hierarchy is already organized.' : 'Diagram is already organized.');
      return;
    }
    recordHistory();
    setNodes((current) => current.map((node) => node.data.locked || !positions.has(node.id)
      ? node
      : { ...node, position: positions.get(node.id)! }));
    if (cinemaLayout.edgeDirections.size) {
      setEdges((current) => current.map((edge) => {
        const direction = cinemaLayout.edgeDirections.get(edge.id);
        return direction ? withCinemaConnectionDirection(edge, direction) : edge;
      }));
    }
    window.setTimeout(() => fitView({ duration: 320, padding: 0.22 }), 0);
    announce(cinemaLayout.handled ? 'Project hierarchy reorganized.' : 'Diagram layout tidied.', 'success');
  }, [announce, cinemaRef, edgesRef, fitView, nodesRef, recordHistory, setEdges, setNodes]);

  const beginConceptEdit = useCallback((id: string) => {
    const node = nodesRef.current.find((item) => item.id === id);
    if (!node || node.data.kind !== 'concept' || node.data.locked) return;
    if (editingConceptId === id) return;
    if (conceptEditOriginRef.current) {
      recordHistory(conceptEditOriginRef.current);
    }
    conceptEditOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current, cinemaRef.current);
    setNodes((current) => current.map((item) => item.id === id ? {
      ...item,
      style: {
        ...item.style,
        width: Math.max(CONCEPT_EDIT_MIN_WIDTH, Number(item.style?.width) || Number(item.measured?.width) || CONCEPT_DEFAULT_WIDTH),
        height: Math.max(CONCEPT_EDIT_MIN_HEIGHT, Number(item.style?.height) || Number(item.measured?.height) || CONCEPT_MIN_HEIGHT),
      },
    } : item));
    setEditingConceptId(id);
    selectNode(id);
  }, [cinemaRef, edgesRef, editingConceptId, nodesRef, recordHistory, selectNode, setNodes]);

  const openLayerEditor = useCallback((id: string) => {
    if (activeLayerEditorId.current === id) {
      if (layerEditTarget(getCurrentDocument(), id)?.role === 'story') setWorkspaceView('canvas');
      return;
    }
    if (writer !== 'writer' || mockProposalPreview || editingConceptId) return;
    const current = getCurrentDocument();
    const target = layerEditTarget(current, id);
    if (!target) return;
    // Story capability controls assisted development, not the local premise
    // editor. A delayed or unavailable capability response must never turn a
    // story-layer gesture into the unrelated inline text editor.
    if (target.role === 'story') setWorkspaceView('canvas');
    const next = target.role === 'story' && !target.readOnly ? ensureStoryProject(current) : current;
    if (next !== current) commitStoryDocument(next);
    layerEditorOrigin.current = structuredClone(next);
    setLayerEditorCard(structuredClone(target.node));
    layerEditRecorded.current = false;
    setLayerEditorError('');
    setLayerReferencesOpen(false);
    selectNode(id);
    activeLayerEditorId.current = id;
    setLayerEditorId(id);
  }, [writer, mockProposalPreview, editingConceptId, getCurrentDocument, commitStoryDocument, selectNode]);

  const openStoryEditor = useCallback(() => {
    const premise = storyPremise(getCurrentDocument());
    if (!premise) { announce('Add a Story premise layer first, then develop it.', 'error'); return; }
    openLayerEditor(premise.nodeId);
  }, [getCurrentDocument, openLayerEditor, announce]);

  useEffect(() => {
    if (!sceneBriefDefaults) return;
    if (activeLayerEditorId.current !== sceneBriefDefaults.sceneNodeId) openLayerEditor(sceneBriefDefaults.sceneNodeId);
  }, [sceneBriefDefaults, openLayerEditor]);

  // Opening a node or resizing the available canvas may frame the editor once.
  // Text, draft, position and selection updates are deliberately not dependencies.
  useEffect(() => {
    if (!layerEditorId) return;
    const node = nodesRef.current.find((item) => item.id === layerEditorId);
    if (!node) return;
    let current = true;
    runAfterCanvasLayout(() => {
      if (current) void setCenter(node.position.x + layerFocus.width / 2, node.position.y + layerFocus.height / 2 + layerFocus.centerOffsetY, { zoom: layerFocus.zoom, duration: 0 });
    });
    return () => { current = false; };
  }, [layerEditorId, setCenter, layerFocus, nodesRef]);

  const commitLayerDocument = useCallback((next: EditorDocument, history = false) => {
    if (writer !== 'writer' || mockProposalPreview) throw Error('This document cannot be edited right now.');
    documentController.commit(next, !layerEditRecorded.current || history); layerEditRecorded.current = true;
    setNodes(current => current.map(node => ({ ...node, selected: node.id === layerEditorId })));
  }, [writer, mockProposalPreview, documentController, setNodes, layerEditorId]);

  const closeLayerEditor = useCallback(() => {
    const closingId = activeLayerEditorId.current;
    activeLayerEditorId.current = null;
    setLayerEditorId(null); setLayerEditorCard(null); setLayerReferencesOpen(false); layerEditorOrigin.current = null;
    setSceneBriefDefaults(null);
    // React Flow temporarily hides the compact wrapper until it remeasures it.
    // Hidden elements cannot receive focus. Wait for that actual condition, and
    // never steal focus if the creator already opened another editor/control.
    let frames = 0;
    const restoreFocus = () => {
      if (!closingId || activeLayerEditorId.current || document.querySelector('dialog[open]')) return;
      const node = [...document.querySelectorAll<HTMLElement>('.react-flow__node')].find((node) => node.dataset.id === closingId);
      if (!node) return;
      if (getComputedStyle(node).visibility === 'hidden') {
        if (++frames < 30) requestAnimationFrame(restoreFocus);
        return;
      }
      if (document.activeElement === document.body || document.activeElement === node) node.focus({ preventScroll: true });
    };
    requestAnimationFrame(restoreFocus);
    void queueDocumentSave(getCurrentDocument());
  }, [getCurrentDocument, queueDocumentSave]);

  const applyManualCreation = useCallback((
    proposal: CanvasCommandProposal,
    selectedId: string,
    editAfterCreate = true,
  ) => {
    try {
      const applied = applyCanvasCommandProposal(getCurrentDocument(), proposal);
      recordHistory();
      setNodes(applied.document.nodes.map((node) => ({ ...node, selected: node.id === selectedId })));
      setEdges(applied.document.edges.map((edge) => ({ ...edge, selected: false })));
      setCinema(applied.document.cinema);
      setSelectedPath(null);
      layerSelectionAnchorRef.current = selectedId;
      window.setTimeout(() => {
        fitView({ nodes: [{ id: selectedId }], duration: 220, padding: 0.65, maxZoom: 1.4 });
        if (editAfterCreate) beginConceptEdit(selectedId);
      }, 60);
      return true;
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The filmmaking layer could not be added.', 'error');
      return false;
    }
  }, [announce, beginConceptEdit, fitView, getCurrentDocument, recordHistory, setCinema, setEdges, setNodes]);

  const createCinemaDraft = useCallback((
    role: CinemaDraftRole,
    options: {
      sourceId?: string;
      relation?: 'child' | 'sibling';
      screenPoint?: { x: number; y: number };
      editAfterCreate?: boolean;
    } = {},
  ) => {
    const descriptor = cinemaDraftDescriptor(role);
    const existingNames = nodesRef.current.map((node) => node.data.name);
    const name = nextCinemaDraftName(role, existingNames);
    const newId = crypto.randomUUID();
    const source = options.sourceId
      ? nodesRef.current.find((node) => node.id === options.sourceId)
      : undefined;
    if (source?.data.locked) return false;
    const relation = options.relation ?? 'child';
    let hierarchyInsertion: ReturnType<typeof resolveCinemaHierarchyInsertion> | null = null;
    if (source && (role === 'scene' || role === 'shot')) {
      try {
        hierarchyInsertion = resolveCinemaHierarchyInsertion(
          nodesRef.current,
          edgesRef.current,
          source.id,
          role,
        );
      } catch (error) {
        announce(error instanceof Error ? error.message : 'The filmmaking hierarchy is invalid.', 'error');
        return false;
      }
    }
    const relativeLayout = source && !hierarchyInsertion
      ? relativeConceptLayout(nodesRef.current, edgesRef.current, source.id, relation, newId)
      : null;
    const center = options.screenPoint
      ? screenToFlowPosition(options.screenPoint)
      : screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const provisionalPosition = relativeLayout?.positions.get(newId) ?? { x: center.x - 110, y: center.y - 46 };
    let nextNode: EditorNode = {
      id: newId,
      type: 'concept',
      position: provisionalPosition,
      style: { width: CONCEPT_DEFAULT_WIDTH, height: CONCEPT_MIN_HEIGHT },
      draggable: true,
      deletable: true,
      selected: false,
      data: {
        kind: 'concept',
        domainType: descriptor.domainType,
        name,
        label: name,
        title: conceptTitleFromPlainText(name),
        body: emptyRichText(),
        eyebrow: descriptor.eyebrow,
        tone: descriptor.tone,
        collapsed: false,
        horizontalAlign: 'left',
        verticalAlign: 'top',
        opacity: 1,
        locked: false,
      },
    };
    const semanticParentId = hierarchyInsertion?.parentId ?? relativeLayout?.parentId ?? null;
    const sourceRole = source?.data.kind === 'concept'
      ? cinemaDraftRole(source.data.domainType, source.data.eyebrow)
      : null;
    const semanticPlacement = semanticParentId && sourceRole
      ? planCinemaDraftInsertion(
        nodesRef.current,
        edgesRef.current,
        cinemaRef.current,
        { parentId: semanticParentId },
        role,
        nextNode,
      )
      : null;
    if (semanticPlacement) nextNode = { ...nextNode, position: semanticPlacement.position };
    const hierarchyEdge: EditorEdge | null = hierarchyInsertion ? {
      id: crypto.randomUUID(),
      source: hierarchyInsertion.parentId,
      target: newId,
      sourceHandle: semanticPlacement?.sourceHandle,
      targetHandle: semanticPlacement?.targetHandle,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#a9adb7', strokeWidth: 1.5 },
      data: { label: '', kind: 'default', relationship: 'hierarchy' },
    } : null;
    const hierarchyLayout = hierarchyInsertion && hierarchyEdge && !semanticPlacement
      ? planCinemaHierarchyLayout(
        [...nodesRef.current, nextNode],
        [...edgesRef.current, hierarchyEdge],
        { ...hierarchyInsertion, newNodeId: newId },
      )
      : null;
    const plannedPosition = hierarchyLayout?.positions.get(newId);
    if (plannedPosition) nextNode = { ...nextNode, position: plannedPosition };
    const commands: CanvasCommandProposal['commands'] = [];
    for (const node of nodesRef.current) {
      const moved = hierarchyLayout?.positions.get(node.id)
        ?? semanticPlacement?.positions.get(node.id)
        ?? (!semanticPlacement ? relativeLayout?.positions.get(node.id) : undefined);
      if (moved && (moved.x !== node.position.x || moved.y !== node.position.y)) {
        commands.push({ type: 'update-node', id: node.id, patch: { position: moved } });
      }
    }
    for (const [edgeId, direction] of semanticPlacement?.edgeDirections ?? []) {
      if (!edgesRef.current.some((edge) => edge.id === edgeId)) continue;
      commands.push({
        type: 'update-edge',
        id: edgeId,
        patch: {
          sourceHandle: direction === 'vertical' ? 'bottom' : null,
          targetHandle: direction === 'vertical' ? 'top' : null,
          type: 'smoothstep',
        },
      });
    }
    if (hierarchyLayout) {
      const nodeById = new Map(nodesRef.current.map((node) => [node.id, node]));
      for (const edgeId of hierarchyLayout.hierarchyEdgeIds) {
        const edge = edgesRef.current.find((candidate) => candidate.id === edgeId);
        if (!edge) continue;
        if (nodeById.get(edge.source)?.data.locked || nodeById.get(edge.target)?.data.locked) continue;
        if (edge.sourceHandle === 'bottom' && edge.targetHandle === 'top'
          && edge.type === 'smoothstep' && edge.data?.relationship === 'hierarchy') continue;
        commands.push({
          type: 'update-edge',
          id: edge.id,
          patch: {
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'smoothstep',
            data: { relationship: 'hierarchy' },
          },
        });
      }
    }
    commands.push({ type: 'create-node', node: nextNode });
    if (hierarchyEdge) {
      commands.push({ type: 'connect-nodes', edge: hierarchyEdge });
    } else if (relativeLayout?.parentId) {
      commands.push({
        type: 'connect-nodes',
        edge: {
          id: crypto.randomUUID(),
          source: relativeLayout.parentId,
          target: newId,
          sourceHandle: semanticPlacement ? semanticPlacement.sourceHandle : 'bottom',
          targetHandle: semanticPlacement ? semanticPlacement.targetHandle : 'top',
          type: 'smoothstep',
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#a9adb7', strokeWidth: 1.5 },
          data: { label: '', kind: 'default', relationship: 'attachment' },
        },
      });
    }
    const created = applyManualCreation({
      version: 1,
      proposalId: `manual-${newId}`,
      summary: `Add ${descriptor.label.toLocaleLowerCase()}`,
      commands,
    }, newId, options.editAfterCreate ?? true);
    if (created) {
      const createdParentId = hierarchyInsertion?.parentId ?? relativeLayout?.parentId;
      if (createdParentId) {
        setCollapsedOutlineBranches((current) => {
          const next = new Set(current);
          next.delete('project');
          next.delete(`scene:${createdParentId}`);
          return next;
        });
      }
      announce(`${descriptor.label} draft added.`, 'success');
    }
    return created;
  }, [announce, applyManualCreation, cinemaRef, edgesRef, nodesRef, screenToFlowPosition]);

  const addConceptAt = useCallback((screenPoint: { x: number; y: number }, editAfterCreate = false) => {
    createCinemaDraft('note', { screenPoint, editAfterCreate });
  }, [createCinemaDraft]);

  const addConceptNode = useCallback(() => setCreationPaletteOpen(true), []);

  const addConceptRelative = useCallback((id: string, relation: 'child' | 'sibling') => {
    const source = nodesRef.current.find((node) => node.id === id);
    if (!source || source.data.locked) return;
    const sourceRole = source.data.kind === 'concept'
      ? cinemaDraftRole(source.data.domainType, source.data.eyebrow)
      : null;
    const role = cinemaRelativeRole(sourceRole, relation) ?? 'note';
    createCinemaDraft(role, { sourceId: id, relation });
  }, [createCinemaDraft, nodesRef]);

  const createFromPalette = useCallback((role: CinemaDraftRole) => {
    const selectedConcept = nodesRef.current.find((node) => node.selected && node.data.kind === 'concept');
    const selectedRole = selectedConcept?.data.kind === 'concept'
      ? cinemaDraftRole(selectedConcept.data.domainType, selectedConcept.data.eyebrow)
      : null;
    const story = nodesRef.current.find((node) => node.data.kind === 'concept'
      && cinemaDraftRole(node.data.domainType, node.data.eyebrow) === 'story');
    const scene = selectedRole === 'scene'
      ? selectedConcept
      : nodesRef.current.find((node) => node.data.kind === 'concept'
        && cinemaDraftRole(node.data.domainType, node.data.eyebrow) === 'scene');
    let created = false;
    if (role === 'shot') {
      if (!scene) {
        announce('Add a scene before adding a shot.', 'error');
        return;
      }
      created = createCinemaDraft(role, { sourceId: scene.id, relation: 'child' });
    } else if (role === 'scene' && selectedRole === 'scene' && selectedConcept) {
      created = createCinemaDraft(role, { sourceId: selectedConcept.id, relation: 'sibling' });
    } else if (role === 'scene' && story) {
      created = createCinemaDraft(role, { sourceId: story.id, relation: 'child' });
    } else if (role !== 'story' && selectedRole === 'scene' && selectedConcept) {
      created = createCinemaDraft(role, { sourceId: selectedConcept.id, relation: 'child' });
    } else if (role === 'note' && selectedConcept) {
      created = createCinemaDraft(role, { sourceId: selectedConcept.id, relation: 'child' });
    } else {
      created = createCinemaDraft(role);
    }
    if (created) setCreationPaletteOpen(false);
  }, [announce, createCinemaDraft, nodesRef]);

  const convertConceptRole = useCallback((nodeId: string, role: CinemaDraftRole) => {
    const node = nodesRef.current.find((candidate) => candidate.id === nodeId);
    if (!node || node.data.kind !== 'concept' || node.data.locked) return;
    const descriptor = cinemaDraftDescriptor(role);
    const converted = applyManualCreation({
      version: 1,
      proposalId: `manual-convert-${nodeId}-${Date.now()}`,
      summary: `Convert layer to ${descriptor.label.toLocaleLowerCase()}`,
      commands: [{
        type: 'update-node',
        id: nodeId,
        patch: {
          data: {
            domainType: descriptor.domainType,
            eyebrow: descriptor.eyebrow,
            tone: descriptor.tone,
          },
        },
      }],
    }, nodeId, false);
    if (converted) announce(`Converted to ${descriptor.label.toLocaleLowerCase()}.`, 'success');
  }, [announce, applyManualCreation, nodesRef]);

  const updateConceptTitle = useCallback((id: string, title: RichTextDocument) => {
    const label = richTextToPlainText(title).slice(0, 500);
    setNodes((current) => current.map((node) => node.id === id && node.data.kind === 'concept'
      ? {
          ...node,
          data: {
            ...node.data,
            name: node.data.name === node.data.label ? label : node.data.name,
            label,
            title,
          },
        }
      : node));
  }, [setNodes]);

  const updateConceptBody = useCallback((id: string, body: RichTextDocument) => {
    setNodes((current) => current.map((node) => node.id === id && node.data.kind === 'concept'
      ? { ...node, data: { ...node.data, body } }
      : node));
  }, [setNodes]);

  const commitConceptEdit = useCallback(() => {
    const id = editingConceptId;
    const origin = conceptEditOriginRef.current;
    if (id) {
      const originNode = origin?.nodes.find((node) => node.id === id);
      const currentNode = nodesRef.current.find((node) => node.id === id);
      const normalizedNode = currentNode?.data.kind === 'concept'
        ? {
            ...currentNode,
            data: {
              ...currentNode.data,
              body: normalizeRichTextDocument(currentNode.data.body),
            },
          }
        : currentNode;
      if (origin && originNode && normalizedNode && JSON.stringify(originNode.data) !== JSON.stringify(normalizedNode.data)) {
        recordHistory(origin);
      }
      if (normalizedNode?.data.kind === 'concept' && normalizedNode.data.domainType === 'cinema.story' && cinemaRef.current?.storyWorkflow?.draft) {
        const text = richTextToPlainText(normalizedNode.data.body);
        setCinema((current) => current?.storyWorkflow?.draft ? { ...current, storyWorkflow: { ...current.storyWorkflow,
          revision: current.storyWorkflow.revision + 1, draft: { ...current.storyWorkflow.draft, premise: text } } } : current);
      }
      setNodes((current) => current.map((node) => {
        if (node.id !== id || node.data.kind !== 'concept') return node;
        const normalized = {
          ...node,
          data: { ...node.data, body: normalizeRichTextDocument(node.data.body) },
        };
        return originNode ? restoreNodeGeometry(normalized, originNode) : normalized;
      }));
    }
    conceptEditOriginRef.current = null;
    setEditingConceptId(null);
  }, [cinemaRef, editingConceptId, nodesRef, recordHistory, setCinema, setNodes]);

  const cancelConceptEdit = useCallback(() => {
    const id = editingConceptId;
    const origin = conceptEditOriginRef.current;
    if (origin) {
      setNodes(origin.nodes);
      setEdges(origin.edges);
      conceptEditOriginRef.current = null;
    }
    setEditingConceptId(null);
    if (id) {
      window.setTimeout(() => {
        const node = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
          .find((element) => element.dataset.id === id);
        node?.focus();
      }, 0);
    }
  }, [editingConceptId, setEdges, setNodes]);

  const beginFieldEdit = useCallback(() => {
    if (!fieldOriginRef.current) {
      fieldOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current, cinemaRef.current);
    }
  }, [cinemaRef, edgesRef, nodesRef]);

  const endFieldEdit = useCallback(() => {
    if (!fieldOriginRef.current) return;
    recordHistory(fieldOriginRef.current);
    fieldOriginRef.current = null;
  }, [recordHistory]);

  const cancelFieldEdit = useCallback(() => {
    const id = renamingLayerId;
    if (fieldOriginRef.current) {
      setNodes(fieldOriginRef.current.nodes);
      setEdges(fieldOriginRef.current.edges);
      fieldOriginRef.current = null;
    }
    setRenamingLayerId(null);
    if (id) {
      window.setTimeout(() => {
        const layer = [...document.querySelectorAll<HTMLElement>('[data-layer-id]')]
          .find((element) => element.dataset.layerId === id);
        layer?.focus();
      }, 0);
    }
  }, [renamingLayerId, setEdges, setNodes]);

  useEffect(() => {
    const beginFromKeyboard = (event: KeyboardEvent) => {
      if (!canvasVisible) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, button, [contenteditable="true"], .premise-expanded-node, .story-assistant-node, .layer-editor-shell')) return;
      if (!target?.closest('.react-flow__node')) return;
      const selected = nodesRef.current.find((node) => node.selected);
      if (!selected) return;
      if (event.key === 'Enter' && !event.shiftKey && layerEditTarget(getCurrentDocument(), selected.id)) {
        event.preventDefault(); event.stopPropagation(); openLayerEditor(selected.id); return;
      }
      if (selected.data.locked) return;
      const supportsBranchCreation = selected.data.kind === 'concept' || selected.data.kind === 'raster';
      if (supportsBranchCreation && event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        addConceptRelative(selected.id, 'child');
        return;
      }
      if (supportsBranchCreation && event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        addConceptRelative(selected.id, 'sibling');
        return;
      }
      if (selected.data.kind !== 'concept' || event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      beginConceptEdit(selected.id);
    };
    window.addEventListener('keydown', beginFromKeyboard, true);
    return () => window.removeEventListener('keydown', beginFromKeyboard, true);
  }, [canvasVisible, addConceptRelative, beginConceptEdit, getCurrentDocument, openLayerEditor, nodesRef]);

  const updateSelectedPath = useCallback(
    (updater: (path: VectorPathLayer) => VectorPathLayer, shouldRecord = true) => {
      if (!selectedPath) return;
      if (shouldRecord) recordHistory();
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
          return {
            ...node,
            data: {
              ...node.data,
              paths: node.data.paths.map((path) =>
                path.id === selectedPath.pathId ? updater(path) : path,
              ),
            },
          };
        }),
      );
    },
    [recordHistory, selectedPath, setNodes],
  );

  const updatePathById = useCallback((nodeId: string, pathId: string, updater: (path: VectorPathLayer) => VectorPathLayer) => {
    updateNode(nodeId, (node) => {
      if (node.data.kind !== 'vector') return node;
      return {
        ...node,
        data: {
          ...node.data,
          paths: node.data.paths.map((path) => path.id === pathId ? updater(path) : path),
        },
      };
    });
  }, [updateNode]);

  const moveSelectedPath = useCallback((direction: -1 | 1) => {
    if (!selectedPath) return;
    recordHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
      const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
      const nextIndex = Math.max(0, Math.min(node.data.paths.length - 1, index + direction));
      if (index < 0 || index === nextIndex || node.data.paths[index].locked) return node;
      const paths = [...node.data.paths];
      const [path] = paths.splice(index, 1);
      paths.splice(nextIndex, 0, path);
      return { ...node, data: { ...node.data, paths } };
    }));
  }, [recordHistory, selectedPath, setNodes]);

  const duplicateSelectedPath = useCallback(() => {
    if (!selectedPath) return;
    const selectedNode = nodesRef.current.find((node) => node.id === selectedPath.nodeId);
    const selected = selectedNode?.data.kind === 'vector'
      ? selectedNode.data.paths.find((path) => path.id === selectedPath.pathId)
      : null;
    if (!selected || selected.locked) return;
    const newPathId = crypto.randomUUID();
    recordHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== selectedPath.nodeId || node.data.kind !== 'vector') return node;
      const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
      const original = node.data.paths[index];
      if (!original || original.locked) return node;
      const copy = { ...structuredClone(original), id: newPathId, name: `${original.name} copy`, locked: false };
      const paths = [...node.data.paths];
      paths.splice(index + 1, 0, copy);
      return { ...node, data: { ...node.data, paths } };
    }));
    setSelectedPath({ nodeId: selectedPath.nodeId, pathId: newPathId });
  }, [nodesRef, recordHistory, selectedPath, setNodes]);

  const deleteSelectedPath = useCallback(() => {
    if (!selectedPath) return;
    const node = nodesRef.current.find((item) => item.id === selectedPath.nodeId);
    if (!node || node.data.kind !== 'vector') return;
    const index = node.data.paths.findIndex((path) => path.id === selectedPath.pathId);
    if (index < 0 || node.data.paths[index].locked) return;
    recordHistory();
    const remaining = node.data.paths.filter((path) => path.id !== selectedPath.pathId);
    setNodes((current) => current.map((item) => item.id === node.id && item.data.kind === 'vector'
      ? { ...item, data: { ...item.data, paths: remaining } }
      : item));
    const next = remaining[Math.min(index, remaining.length - 1)];
    setSelectedPath(next ? { nodeId: node.id, pathId: next.id } : null);
  }, [nodesRef, recordHistory, selectedPath, setNodes]);

  const toggleNodeVisibility = useCallback((id: string) => {
    const selected = nodesRef.current.find((node) => node.id === id);
    if (!selected) return;
    if (!selected.hidden) {
      updateNode(id, (node) => ({ ...node, hidden: true }));
      return;
    }
    const revealedNodes = nodesRef.current.map((node) => node.id === id ? { ...node, hidden: false } : node);
    try {
      const rootId = cinemaHierarchyRootId(revealedNodes, edgesRef.current, id);
      const layout = rootId
        ? planCinemaHierarchyLayout(revealedNodes, edgesRef.current, { rootId })
        : null;
      recordHistory();
      setNodes(revealedNodes.map((node) => ({
        ...node,
        position: layout?.positions.get(node.id) ?? node.position,
      })));
      if (layout) announce('Layer shown and its cinema hierarchy spacing was checked.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The layer could not be shown safely.', 'error');
    }
  }, [announce, edgesRef, nodesRef, recordHistory, setNodes, updateNode]);

  const toggleNodeLock = useCallback((id: string) => {
    updateNode(id, (node) => ({
      ...node,
      draggable: node.data.locked,
      deletable: node.data.locked,
      data: { ...node.data, locked: !node.data.locked },
    }));
  }, [updateNode]);

  const duplicateSelected = () => {
    const selected = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!selected) return;
    const copy: EditorNode = {
      ...structuredClone(selected),
      id: crypto.randomUUID(),
      position: { x: selected.position.x + 28, y: selected.position.y + 28 },
      selected: true,
      draggable: true,
      deletable: true,
      data: {
        ...structuredClone(selected.data),
        name: `${selected.data.name} copy`,
        locked: false,
      },
    };
    recordHistory();
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      copy,
    ]);
  };

  const deleteSelected = () => {
    const selected = nodesRef.current.find((node) => node.id === selectedNodeId);
    if (!selected || selected.data.locked) return;
    void deleteElements({ nodes: [selected] });
  };

  const moveLayer = useCallback((id: string, direction: -1 | 1) => {
    recordHistory();
    setNodes((current) => {
      const index = current.findIndex((node) => node.id === id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + direction));
      if (index < 0 || index === nextIndex) return current;
      const copy = [...current];
      const [node] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, node);
      return copy;
    });
  }, [recordHistory, setNodes]);

  const resetDocument = useCallback(async () => {
    const source = documentController.capture();
    const confirmed = await requestConfirmation({
      tone: 'warning',
      eyebrow: 'New project',
      title: 'Start a new local document?',
      description: 'The current canvas on this device will be replaced with the clean Cineserye starting structure.',
      impact: 'Recovery state and pending proposals for this document will be cleared.',
      reassurance: 'Download a backup first if you may need this version later.',
      confirmLabel: 'Start new document',
    });
    if (!confirmed) return;
    try {
      conversionControllerRef.current?.abort();
      planningControllerRef.current?.abort('new-document');
      await documentController.replace(initialDocument, source, (document, assertCurrent) => replaceLocalDocument(document, { clearRecovery: true, assertCurrent }));
      setRecoveryDocument(null);
      setSelectedPath(null);
      setMockProposalPreview(null);
      setMockProposalStage('idle');
      setPreviewSelectedNodeId(null);
      setSceneBriefDefaults(null);
      setProposalCinema(null);
      setProposalMode(null);
      setPendingProposalId(null);
      setWorkspaceView('canvas');
      window.setTimeout(() => fitView({ duration: 260, padding: 0.22 }), 0);
      announce('New local document created.', 'success');
    } catch {
      announce('The local project could not be cleared. Download a backup before trying again.', 'error');
    }
  }, [announce, fitView, documentController, requestConfirmation]);

  const chooseStartScene = useCallback(() => {
    if (!firstRunOpen) recordHistory();
    setNodes(structuredClone(initialDocument.nodes).map((node) => ({
      ...node,
      selected: false,
    })));
    setEdges(structuredClone(initialDocument.edges));
    setTitle(initialDocument.title);
    setCinema(undefined);
    setWorkspaceView('canvas');
    setFirstRunOpen(false);
    window.setTimeout(() => fitView({ duration: 260, padding: 0.22 }), 0);
    announce('Clean scene workspace ready. Edit Scene 01, then generate a shot plan.', 'success');
  }, [announce, firstRunOpen, fitView, recordHistory, setCinema, setEdges, setNodes, setTitle]);

  const chooseStartIdea = useCallback(() => {
    if (!firstRunOpen) recordHistory();
    const next = ensureStoryProject(createStoryStarterDocument());
    setNodes(next.nodes); setEdges(next.edges); setCinema(next.cinema); setTitle(next.title);
    setWorkspaceView('canvas'); setFirstRunOpen(false);
    // Open only after the new graph mounts. This is an explicit user action,
    // not a default insertion or a provider call.
    window.setTimeout(() => openLayerEditor('story-premise'), 0);
  }, [firstRunOpen, recordHistory, setNodes, setEdges, setCinema, setTitle, openLayerEditor]);

  const chooseSampleProject = useCallback(() => {
    if (!firstRunOpen) recordHistory();
    const sample = applyCanvasCommandProposal(initialDocument, MOCK_SHOT_PLAN_PROPOSAL).document;
    setNodes(sample.nodes.map((node) => ({ ...node, selected: node.id === 'cine-shot-03' })));
    setEdges(sample.edges.map((edge) => ({ ...edge, selected: false })));
    setTitle(REEL_KNOWS_TOMORROW.title);
    // Opening a new sample is a new project, not a restore of every other
    // browser's sample. Saved backups retain their identity on restoration.
    setCinema({ ...structuredClone(MOCK_CINEMA_PROJECT_DATA), projectId: crypto.randomUUID() });
    setWorkspaceView('canvas');
    setFirstRunOpen(false);
    window.setTimeout(() => fitView({ duration: 320, padding: 0.14 }), 0);
    announce('Sample opened locally with fixture sources. No external request was made.', 'success');
  }, [announce, firstRunOpen, fitView, recordHistory, setCinema, setEdges, setNodes, setTitle]);

  const recoverLastNonEmptyCanvas = useCallback(async () => {
    if (!recoveryDocument) return;
    try {
      const restored = structuredClone(recoveryDocument);
      await documentController.replace(restored, documentController.capture(), (document, assertCurrent) => replaceLocalDocument(document, { clearRecovery: true, assertCurrent }), true);
      setWorkspaceView('canvas');
      setSelectedPath(null);
      setRecoveryDocument(null);
      window.setTimeout(() => fitView({ duration: 300, padding: 0.22 }), 0);
      announce('Last non-empty canvas recovered.', 'success');
    } catch {
      announce('The recovery copy could not be restored. Try a checkpoint or project backup.', 'error');
    }
  }, [announce, fitView, documentController, recoveryDocument]);

  const openExport = useCallback(() => setExportOpen(true), []);
  const openBackup = useCallback(() => setBackupOpen(true), []);
  const exportLocalTraces = useCallback(() => {
    const artifact = {
      format: 'cineserye-agent-traces',
      version: 1,
      exportedAt: new Date().toISOString(),
      telemetryPolicy: 'no-content-v1',
      traces: localCinemaTraces,
    };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cineserye-agent-traces-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    announce(`${localCinemaTraces.length} local ${localCinemaTraces.length === 1 ? 'trace' : 'traces'} exported.`, 'success');
  }, [announce, localCinemaTraces]);
  const performBackup = useCallback(async () => {
    try {
      const document = getCurrentDocument();
      const visual = document.cinema?.visualPreproduction;
      const requiredHashes = new Set([
        ...storyReferenceMediaHashes(document.cinema?.storyWorkflow),
        ...Object.values(visual?.references ?? {}).flatMap((reference) => reference.blobHash ? [reference.blobHash] : []),
        ...Object.values(visual?.storyboardFrames ?? {}).map((frame) => frame.blobHash),
      ]);
      const media = (await listLocalMediaBlobs()).filter((entry) => requiredHashes.has(entry.hash));
      const missing = [...requiredHashes].filter((hash) => !media.some((entry) => entry.hash === hash));
      if (missing.length) throw new Error(`${missing.length} referenced local media ${missing.length === 1 ? 'item is' : 'items are'} missing. Restore it before creating a portable backup.`);
      downloadProjectBackup(
        await serializeProjectBackupWithMedia(document, media),
        safeFileBase(titleRef.current),
      );
      const videoClipCount = Object.keys(visual?.videoClips ?? {}).length;
      announce(`Project backup downloaded. Includes ${media.length} local image ${media.length === 1 ? 'item' : 'items'}${videoClipCount ? `; ${videoClipCount} video ${videoClipCount === 1 ? 'clip is' : 'clips are'} metadata-only and must be downloaded separately` : ''}.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Project backup failed.', 'error');
    }
  }, [announce, getCurrentDocument, titleRef]);

  const createCheckpoint = useCallback(async () => {
    try {
      await createLocalCheckpoint(getCurrentDocument());
      setCheckpoints(await listLocalCheckpoints());
      announce('Local checkpoint created.', 'success');
    } catch {
      announce('The checkpoint could not be created.', 'error');
    }
  }, [announce, getCurrentDocument]);

  const restoreCheckpoint = useCallback(async (checkpoint: LocalCheckpoint) => {
    const source = documentController.capture();
    const confirmed = await requestConfirmation({
      tone: 'warning',
      eyebrow: 'Version checkpoint',
      title: 'Restore this checkpoint?',
      description: `“${checkpoint.title}” from ${new Date(checkpoint.createdAt).toLocaleString()} will replace the current canvas.`,
      impact: 'Any cinema data attached to the checkpoint will be restored with it.',
      reassurance: 'Current work remains available through Undo after the checkpoint is restored.',
      confirmLabel: 'Restore checkpoint',
    });
    if (!confirmed) return;
    try {
    const restored = structuredClone(checkpoint.document);
    conversionControllerRef.current?.abort(); planningControllerRef.current?.abort('restore-checkpoint');
    await documentController.replace(restored, source, (document, assertCurrent) => replaceLocalDocument(document, { assertCurrent }), true);
    setSelectedPath(null);
    setMockProposalPreview(null);
    setMockProposalStage('idle');
    setPreviewSelectedNodeId(null);
    setSceneBriefDefaults(null);
    setProposalCinema(null);
    setProposalMode(null);
    setWorkspaceView('canvas');
    setBackupOpen(false);
    window.setTimeout(() => fitView({ duration: 300, padding: 0.22 }), 0);
    announce('Checkpoint restored.', 'success');
    } catch (error) { announce(error instanceof Error ? error.message : 'Checkpoint restoration failed.', 'error'); }
  }, [announce, fitView, documentController, requestConfirmation]);

  const removeCheckpoint = useCallback(async (id: string) => {
    try {
      await deleteLocalCheckpoint(id);
      setCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== id));
      announce('Checkpoint deleted.');
    } catch {
      announce('The checkpoint could not be deleted.', 'error');
    }
  }, [announce]);

  const restoreProject = useCallback(async (file: File) => {
    const source = documentController.capture();
    try {
      if (file.size > MAX_PROJECT_FILE_SIZE) throw new Error('The project backup is larger than 40 MB.');
      const parsed = await parseProjectBackupWithMedia(await file.text());
      const restored = parsed.document;
      const mediaLabel = parsed.media.length === 1 ? 'item' : 'items';
      const confirmed = await requestConfirmation({
        tone: 'warning',
        eyebrow: 'Portable backup',
        title: 'Restore this backup?',
        description: `“${restored.title}” will replace the current canvas.`,
        impact: `${parsed.media.length} verified local media ${mediaLabel} will also be restored.`,
        reassurance: 'The backup is validated before any project or media data is replaced.',
        confirmLabel: 'Restore backup',
      });
      if (!confirmed) return;
      conversionControllerRef.current?.abort();
      planningControllerRef.current?.abort('restore-project');
      await documentController.replace(restored, source, (document, assertCurrent) => replaceLocalDocument(document, { media: parsed.media, assertCurrent }));
      setSelectedPath(null);
      setMockProposalPreview(null);
      setMockProposalStage('idle');
      setPreviewSelectedNodeId(null);
      setSceneBriefDefaults(null);
      setProposalCinema(null);
      setProposalMode(null);
      setExpandedVectors(new Set());
      setWorkspaceView('canvas');
      setBackupOpen(false);
      window.setTimeout(() => fitView({ duration: 300, padding: 0.22 }), 60);
      announce(`Project backup restored. ${parsed.media.length} verified local media ${parsed.media.length === 1 ? 'item' : 'items'} included.`, 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'The project backup could not be restored.', 'error');
    }
  }, [announce, fitView, documentController, requestConfirmation]);

  const performExport = useCallback(() => {
    try {
      const collapsed = collapsedDescendantIds(nodesRef.current, edgesRef.current);
      const exportNodes = nodesRef.current.map((node) => collapsed.has(node.id) ? { ...node, hidden: true } : node);
      const exportEdges = edgesRef.current.filter((edge) => !collapsed.has(edge.source) && !collapsed.has(edge.target));
      const svg = buildSvgDocument(exportNodes, exportEdges);
      downloadSvg(svg, safeFileBase(title));
      setExportOpen(false);
      announce('Editable SVG exported.', 'success');
    } catch (error) {
      announce(error instanceof Error ? error.message : 'Export failed.', 'error');
    }
  }, [announce, edgesRef, nodesRef, title]);

  const hasChildren = useCallback((id: string) => edgesRef.current.some((edge) => edge.source === id), [edgesRef]);

  const toggleBranch = useCallback((id: string) => {
    updateNode(id, (node) => node.data.kind === 'concept'
      ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } }
      : node);
  }, [updateNode]);

  const storyReferenceCount = cinema?.storyWorkflow?.references.length ?? 0;
  const nodeActionValue = useMemo<NodeActionContextValue>(
    () => ({
      convertingId,
      editingConceptId,
      openLayerEditor,
      keepImage,
      vectorizeImage,
      cancelVectorization,
      beginConceptEdit,
      updateConceptTitle,
      updateConceptBody,
      commitConceptEdit,
      cancelConceptEdit,
      toggleBranch,
      hasChildren,
      addConceptRelative,
      openStory: openStoryEditor,
      storyReferenceCount,
      storyEnabled,
      recordResizeStart: () => {
        if (!resizeOriginRef.current) {
          resizeOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current, cinemaRef.current);
        }
      },
      recordResize: (id, dimensions) => {
        if (!resizeOriginRef.current) return;
        const resizedNodes = nodesRef.current.map((node) => node.id === id
          ? {
              ...node,
              position: { x: dimensions.x, y: dimensions.y },
              style: { ...node.style, width: dimensions.width, height: dimensions.height },
            }
          : node);
        setNodes(resizedNodes);
      },
      recordResizeEnd: (id) => {
        const origin = resizeOriginRef.current;
        const originNode = origin?.nodes.find((node) => node.id === id);
        const currentNode = nodesRef.current.find((node) => node.id === id);
        const originSize = originNode ? editorNodeDimensions(originNode) : null;
        const currentSize = currentNode ? editorNodeDimensions(currentNode) : null;
        const changed = Boolean(originNode && originSize && currentNode && currentSize && (
          Math.abs(originSize.width - currentSize.width) >= 0.01
          || Math.abs(originSize.height - currentSize.height) >= 0.01
          || Math.abs(originNode.position.x - currentNode.position.x) >= 0.01
          || Math.abs(originNode.position.y - currentNode.position.y) >= 0.01
        ));
        if (origin && changed) recordHistory(origin);
        resizeOriginRef.current = null;
      },
    }),
    [convertingId, editingConceptId, openLayerEditor, keepImage, vectorizeImage, cancelVectorization, beginConceptEdit, updateConceptTitle, updateConceptBody, commitConceptEdit, cancelConceptEdit, toggleBranch, hasChildren, addConceptRelative, openStoryEditor, storyReferenceCount, storyEnabled, nodesRef, edgesRef, cinemaRef, setNodes, recordHistory],
  );

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const layerNodes = [...presentedNodes].reverse().filter((node) => {
    if (!normalizedSearch) return true;
    const searchable = [
      node.data.name,
      node.data.kind === 'concept' ? node.data.label : '',
      node.data.kind === 'concept' ? node.data.eyebrow : '',
      node.data.kind === 'concept' ? richTextToPlainText(node.data.body) : '',
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const sidebarLayerNodes = layerNodes;
  const cinemaOutlineModel = useMemo(
    () => buildUnifiedProjectOutline(
      presentedNodes,
      presentedEdges,
      activeCinemaData ?? undefined,
      previewNodeIds,
      searchQuery,
    ),
    [activeCinemaData, presentedEdges, presentedNodes, previewNodeIds, searchQuery],
  );
  const handleLayerSelection = useCallback((event: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    if (mockProposalPreview) {
      setPreviewSelectedNodeId(id);
      setSelectedPath(null);
      return;
    }
    const anchorId = layerSelectionAnchorRef.current;
    if (event.shiftKey && anchorId) {
      const anchorIndex = sidebarLayerNodes.findIndex((node) => node.id === anchorId);
      const targetIndex = sidebarLayerNodes.findIndex((node) => node.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        const rangeIds = new Set(sidebarLayerNodes.slice(start, end + 1).map((node) => node.id));
        setNodes((current) => current.map((node) => ({ ...node, selected: rangeIds.has(node.id) })));
        setEdges((current) => current.map((edge) => edge.selected ? { ...edge, selected: false } : edge));
        setSelectedPath(null);
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      if (!anchorId) layerSelectionAnchorRef.current = id;
      selectNode(id, true);
      return;
    }

    layerSelectionAnchorRef.current = id;
    revealAndSelectNode(id);
  }, [mockProposalPreview, revealAndSelectNode, selectNode, setEdges, setNodes, sidebarLayerNodes]);
  const handleOutlineSelection = useCallback((id: string, additive = false) => {
    if (mockProposalPreview) {
      setPreviewSelectedNodeId(id);
      setSelectedPath(null);
    } else if (additive) {
      selectNode(id, true);
    } else {
      revealAndSelectNode(id, { padding: 0.6, maxZoom: 1.35 });
      return;
    }
    runAfterCanvasLayout(() => { void fitView({ nodes: [{ id }], duration: 280, padding: 0.6, maxZoom: 1.35 }); });
  }, [fitView, mockProposalPreview, revealAndSelectNode, selectNode]);
  const openSceneCreationPalette = useCallback((id: string) => {
    const scene = nodesRef.current.find((node) => node.id === id);
    if (!scene || scene.data.locked || mockProposalPreview) return;
    selectNode(id);
    layerSelectionAnchorRef.current = id;
    setCreationPaletteOpen(true);
  }, [mockProposalPreview, nodesRef, selectNode]);
  const focusOutlineNodes = useCallback((ids: string[]) => {
    if (!ids.length) return;
    runAfterCanvasLayout(() => { void fitView({ nodes: ids.map((id) => ({ id })), duration: 300, padding: 0.3, maxZoom: 1.2 }); });
  }, [fitView]);
  const toggleOutlineBranch = useCallback((id: UnifiedOutlineBranchId) => {
    setCollapsedOutlineBranches((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const collapsedNodeIds = useMemo(
    () => collapsedDescendantIds(presentedNodes, presentedEdges),
    [presentedEdges, presentedNodes],
  );
  const canvasNodes = useMemo(
    () => presentedNodes.map((node) => {
      if (node.id === layerEditorId) return {
        ...node, width: layerFocus.width, height: layerFocus.height, measured: { width: layerFocus.width, height: layerFocus.height },
        style: { ...node.style, width: layerFocus.width, height: layerFocus.height, minHeight: layerFocus.height },
        className: 'expanded-story-host', draggable: !node.data.locked && toolMode === 'select' && !temporaryPanActive && !mockProposalPreview, dragHandle: '.layer-drag-handle', zIndex: 100,
        hidden: Boolean(node.hidden || collapsedNodeIds.has(node.id)),
      };
      const previewPresentation = mockProposalPreview ? {
        className: previewNodeIds.has(node.id) ? 'proposal-ghost-node' : 'proposal-context-node',
        draggable: false,
        deletable: false,
        data: { ...node.data, locked: true },
      } : {};
      const cinemaKind = activeCinemaProject.nodes[node.id]?.kind;
      const simplifiedContextClass = cinemaKind && !['story', 'scene'].includes(cinemaKind) ? 'simplified-nonstory-context' : '';
      const presentedClass = mockProposalPreview ? (previewNodeIds.has(node.id) ? 'proposal-ghost-node' : 'proposal-context-node') : node.className;
      const className = [presentedClass, simplifiedContextClass].filter(Boolean).join(' ') || undefined;
      if (node.data.kind !== 'concept') {
        return {
          ...node,
          ...previewPresentation,
          className,
          hidden: Boolean(node.hidden || collapsedNodeIds.has(node.id)),
        };
      }
      const minimumHeight = Number(node.style?.height) || CONCEPT_MIN_HEIGHT;
      const style = {
        ...node.style,
        height: node.resizing ? minimumHeight : undefined,
        minHeight: minimumHeight,
        '--concept-min-block-size': `${minimumHeight}px`,
      } as CSSProperties;
      return {
        ...node,
        ...previewPresentation,
        className,
        style,
        hidden: Boolean(node.hidden || collapsedNodeIds.has(node.id)),
      };
    }),
    [activeCinemaProject.nodes, collapsedNodeIds, mockProposalPreview, presentedNodes, previewNodeIds, layerEditorId, toolMode, temporaryPanActive, layerFocus],
  );
  const canvasEdges = useMemo(
    () => {
      const nodeNames = new Map(presentedNodes.map((node) => [node.id, node.data.name]));
      const affectedEdgeIds = new Set(mockProposalPreview?.affectedEdgeIds ?? []);
      const visibleEdges = presentedEdges
        .filter((edge) => !collapsedNodeIds.has(edge.source) && !collapsedNodeIds.has(edge.target));
      const routes = planCinemaHierarchyBusRoutes(canvasNodes, visibleEdges);
      return visibleEdges.map((edge) => {
        const route = routes.get(edge.id);
        const affected = affectedEdgeIds.has(edge.id);
        const contextual = [edge.source, edge.target].some((id) => {
          const kind = activeCinemaProject.nodes[id]?.kind;
          return kind && !['story', 'scene'].includes(kind);
        });
        const className = [affected ? 'proposal-ghost-edge' : route ? 'cinema-hierarchy-bus-edge' : edge.className,
          contextual ? 'simplified-nonstory-context' : ''].filter(Boolean).join(' ');
        return ({
          ...edge,
          ...(route && !affected ? {
            type: CINEMA_HIERARCHY_BUS_EDGE_TYPE,
            className: [edge.className, 'cinema-hierarchy-bus-edge'].filter(Boolean).join(' '),
            data: {
              label: edge.data?.label ?? '',
              kind: edge.data?.kind ?? 'default',
              ...edge.data,
              cinemaRoute: route.kind,
              cinemaRouteTrunkX: route.trunkX,
            },
            domAttributes: {
              ...edge.domAttributes,
              'data-cinema-route': route.kind,
              'data-cinema-trunk-x': String(route.trunkX),
            },
          } : {}),
          ...(affected ? {
            className: [edge.className, 'proposal-ghost-edge'].filter(Boolean).join(' '),
            animated: true,
            style: { stroke: '#716af2', strokeWidth: 1.75, strokeDasharray: '6 5' },
          } : {}),
          className,
          ariaLabel: `Connector from ${nodeNames.get(edge.source) ?? edge.source} to ${nodeNames.get(edge.target) ?? edge.target}${edge.data?.label ? `: ${edge.data.label}` : ''}`,
        });
      });
    },
    [activeCinemaProject.nodes, canvasNodes, collapsedNodeIds, mockProposalPreview, presentedEdges, presentedNodes],
  );

  const layerDocument = useMemo<EditorDocument>(() => ({ schemaVersion: 5, title, nodes, edges, cinema, updatedAt: 0 }), [cinema, edges, nodes, title]);
  const operationSnapshot = useSyncExternalStore(subscribeClientOperations, () => {
    try { return JSON.stringify(listClientOperations(cinema?.projectId)); }
    catch { return '[]'; }
  }, () => '[]');
  const stageProjection = useMemo(() => projectStageProjection({ cinema,
    hasPremise: Boolean(storyPremise(layerDocument)?.text.trim()), operations: JSON.parse(operationSnapshot),
    capabilities: workspaceCapabilities.value, capabilityError: workspaceCapabilities.status === 'error',
  }), [cinema, layerDocument, operationSnapshot, workspaceCapabilities.status, workspaceCapabilities.value]);
  const storyAssistant = useStoryAssistant(layerDocument, getCurrentDocument, commitStoryDocument, () => queueDocumentSave(getCurrentDocument()), workspaceCapabilities.value);
  const assistantState = cinema?.storyWorkflow?.assistant;
  const acceptedSession = storyReviewSession(cinema?.storyWorkflow);
  const compactProduction = Boolean(acceptedSession?.accepted.length && acceptedSession.presentation !== 'scene-review' && !cinema?.storyWorkflow?.shotPlanning && expandedShotSetup !== acceptedSession.id);
  const assistantPreferredHeight = assistantState?.collapsed ? 180 : compactProduction ? 360 : 640;
  const assistantFocus = editorFocusGeometry(focusSpace, 460, assistantPreferredHeight);
  // Reserve the full working area when focusing, but keep the initial invitation compact.
  // This depends on workflow state, never text length or measurements while typing.
  const compactInvitation = assistantState?.state === 'review' && !assistantState.checkpoint && !cinema?.storyWorkflow?.sessions.length;
  const assistantProjection = projectStoryAssistant(nodes, assistantState, compactInvitation ? Math.min(360, assistantFocus.height) : assistantFocus.height, assistantFocus.width);
  if (assistantProjection && (toolMode !== 'select' || temporaryPanActive || mockProposalPreview)) assistantProjection.node.draggable = false;
  const openStoryAssistant = () => {
    const premise = storyPremise(getCurrentDocument());
    if (!premise?.text.trim() && !cinemaRef.current?.sceneOrder.length && cinemaRef.current?.storyWorkflow?.draft?.mode !== 'surprise') { openStoryEditor(); return; }
    storyAssistant.open(); closeLayerEditor(); setWorkspaceView('canvas'); setAssistantOpenEpoch((value) => value + 1);
  };
  const openSimplifiedStory = () => {
    const current = getCurrentDocument();
    if (!storyPremise(current)) {
      // Explicit creation adds a premise; it must never replace an existing project.
      const node = { ...createStoryStarterDocument().nodes[0], id: crypto.randomUUID() };
      const next = ensureStoryProject({ ...current, nodes: [...current.nodes, node],
        // Older projects can point at a generic planning/root card. Keep that
        // card and its links, but make the explicitly added premise canonical.
        cinema: current.cinema ? { ...current.cinema, projectNodeId: node.id } : undefined });
      commitStoryDocument(next);
      window.setTimeout(() => openLayerEditor(node.id), 0);
    } else openStoryAssistant();
  };
  const openSimplifiedLayer = (id: string) => {
    setShotDetailOpen(true); setWorkspaceView('canvas');
    // The Shots overview hides the React Flow surface. Let that surface regain
    // real dimensions before mounting and framing the expanded editor.
    requestAnimationFrame(() => requestAnimationFrame(() => openLayerEditor(id)));
  };
  const applyStageAction = (action: StageAction) => {
    if (action.kind === 'open-story-editor') { openSimplifiedStory(); return; }
    if (action.kind === 'open-story-assistant') { openStoryAssistant(); return; }
    if (action.kind === 'open-scene' || action.kind === 'open-shot') {
      if (!action.targetId) return;
      openSimplifiedLayer(action.targetId); return;
    }
    if (action.kind === 'select-stage' && action.targetId) {
      filmmaking.select(action.targetId as FilmmakingStage); setShotDetailOpen(false); setWorkspaceView('canvas'); return;
    }
    if (action.kind === 'refresh-status') void workspaceCapabilities.refresh();
  };
  const switchWorkspacePreview = async (enabled: boolean) => {
    const destination = enabled ? 'simplified preview' : 'original workspace';
    if (await requestConfirmation({ tone: 'warning', eyebrow: 'Workspace preview', title: `Switch to the ${destination}?`,
      description: 'Your project edits stay in memory; this does not reload the page.',
      impact: 'Temporary Final Cut trims and undownloaded exports will reset. An active local render request will be cancelled.',
      reassurance: 'Download your rendered cut first. Story, shots and saved media are kept.', confirmLabel: `Switch to ${destination}` })) setSimplifiedPreview(enabled);
  };
  const focusStoryAssistant = () => {
    const node = assistantProjection?.node;
    const canvas = document.querySelector('.canvas-region .react-flow')?.getBoundingClientRect();
    if (node && canvas) {
      if (filmmaking.enabled && filmmaking.workspace === 'story' && assistantState && focusSpace.width >= 1_000) {
        requestAnimationFrame(() => { void fitView({ nodes: [{ id: assistantState.premiseNodeId }, { id: node.id }], padding: 0.08, maxZoom: 1, duration: 0 }); });
        return;
      }
      void setCenter(node.position.x + assistantFocus.width / 2, node.position.y + assistantFocus.height / 2 + assistantFocus.centerOffsetY, { zoom: assistantFocus.zoom, duration: 0 });
    }
  };
  // Only intentional navigation/open or viewport resizing frames the Assistant.
  // Never depend on answers, streamed content, source revisions or drag position.
  const assistantVisible = Boolean(assistantState && !assistantState.hidden);
  useEffect(() => {
    if (!hydrated || initialOverviewFramed.current) return;
    // Intentional editor/Assistant navigation owns its own framing. Never let
    // the initial overview fit compete with it, including on reload.
    if (firstRunOpen || assistantVisible || layerEditorId) {
      initialOverviewFramed.current = true;
      return;
    }
    if (!nodesInitialized || !nodes.length) return;
    const frame = requestAnimationFrame(() => {
      const measured = getNodes();
      // The loaded controlled nodes must have reached React Flow's store before
      // fitting; hydration alone can precede that update in WebKit.
      if (measured.length !== nodes.length || nodes.some((node) => {
        const actual = measured.find((item) => item.id === node.id);
        return !actual || actual.position.x !== node.position.x || actual.position.y !== node.position.y
          || (!actual.hidden && (!actual.measured?.width || !actual.measured?.height));
      })) return;
      initialOverviewFramed.current = true;
      void fitView({ nodes: nodes.map(({ id }) => ({ id })), padding: 0.22, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [hydrated, firstRunOpen, assistantVisible, layerEditorId, nodesInitialized, nodes, getNodes, fitView]);
  useEffect(() => {
    if (!assistantVisible || layerEditorId) return;
    const state = cinemaRef.current?.storyWorkflow?.assistant;
    if (!state) return;
    if (filmmaking.enabled && filmmaking.workspace === 'story' && assistantProjection && focusSpace.width >= 1_000) {
      requestAnimationFrame(() => { void fitView({ nodes: [{ id: state.premiseNodeId }, { id: assistantProjection.node.id }], padding: 0.08, maxZoom: 1, duration: 0 }); });
      return;
    }
    const geometry = editorFocusGeometry(focusSpace, 460, assistantPreferredHeight);
    void setCenter(state.position.x + geometry.width / 2, state.position.y + geometry.height / 2 + geometry.centerOffsetY, { zoom: geometry.zoom, duration: 0 });
    // Stage height alone must not navigate; only explicit open/focus/resize does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantVisible, assistantOpenEpoch, focusSpace, layerEditorId, setCenter, filmmaking.enabled, filmmaking.workspace, fitView]);
  const revealAcceptedScenes = (sceneIds: string[]) => {
    const current = getCurrentDocument(), helper = current.cinema?.storyWorkflow?.assistant;
    if (!helper || !sceneIds.length) return;
    const next = structuredClone(current), narrow = focusSpace.width < 700;
    const geometry = editorFocusGeometry(focusSpace, 460, 360);
    const newHosts = sceneIds.map((id) => next.nodes.find((node) => node.id === next.cinema!.scenes[id]?.nodeId)).filter((node): node is EditorNode => Boolean(node));
    const obstacles = next.nodes.filter((node) => !newHosts.includes(node));
    let y = helper.position.y + (narrow ? geometry.height + 72 : 0);
    for (const node of newHosts) {
      node.position = avoidAssistantOverlap({ ...next, nodes: obstacles }, node, { x: helper.position.x + (narrow ? 0 : geometry.width + 80), y }, geometry);
      obstacles.push(node); y = node.position.y + editorNodeDimensions(node).height + 32;
    }
    commitStoryDocument(next, false);
    const completedSession = storyReviewSession(next.cinema?.storyWorkflow);
    if (filmmaking.enabled && completedSession?.proposals.length
      && completedSession.proposals.every((proposal) => completedSession.accepted.some((item) => item.proposalId === proposal.id))) {
      // Acceptance may advance session navigation, but never dispatches shot planning.
      filmmaking.select('plan'); setExpandedShotSetup(completedSession.id);
    }
    // Explicit Add-scenes navigation: show the new result, not a background auto-fit.
    // Mobile preserves readable controls and reveals the first card; further cards remain below it.
    const shown = narrow ? newHosts.slice(0, 1) : newHosts;
    const boxes = [{ ...helper.position, width: geometry.width, height: geometry.height }, ...shown.map((node) => ({ ...node.position, ...editorNodeDimensions(node) }))];
    const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
    const width = Math.max(...boxes.map((box) => box.x + box.width)) - left, height = Math.max(...boxes.map((box) => box.y + box.height)) - top;
    const zoom = Math.min(1, (focusSpace.width - 32) / width, (focusSpace.height - focusSpace.top - focusSpace.bottom - 32) / height);
    requestAnimationFrame(() => { void setCenter(left + width / 2, top + height / 2 + (focusSpace.bottom - focusSpace.top) / (2 * zoom), { zoom: Math.max(.15, zoom), duration: 0 }); });
  };
  const layerTarget = layerEditorId ? layerEditTarget(layerDocument, layerEditorId) : null;
  const focusExpandedStory = () => {
    const node = nodesRef.current.find((node) => node.id === layerEditorId);
    const canvas = document.querySelector('.canvas-region .react-flow')?.getBoundingClientRect();
    if (node && canvas) {
      void setCenter(node.position.x + layerFocus.width / 2, node.position.y + layerFocus.height / 2 + layerFocus.centerOffsetY, { zoom: layerFocus.zoom, duration: 0 });
    }
  };
  const changeLayer = (change: (document: EditorDocument) => EditorDocument) => {
    try { commitLayerDocument(change(getCurrentDocument())); setLayerEditorError(''); }
    catch (error) { setLayerEditorError((error as Error).message); }
  };
  const discardLayerChanges = () => {
    if (!layerEditorId) return;
    const origin = layerEditorOrigin.current;
    if (!origin) return;
    const original = layerEditTarget(origin, layerEditorId);
    if (!original) return;
    changeLayer((document) => {
      let next = editLayerText(document, layerEditorId, { title: original.title, body: original.body });
      if (original.shot) next = editLayerShot(next, layerEditorId, { durationSeconds: original.shot.durationSeconds, framing: original.shot.framing, cameraMovement: original.shot.cameraMovement, audio: original.shot.audio, purpose: original.shot.purpose, lensMm: original.shot.lensMm, risk: original.shot.risk });
      if (original.role === 'story' && next.cinema?.storyWorkflow) next.cinema.storyWorkflow.draft = structuredClone(origin.cinema?.storyWorkflow?.draft ?? null);
      return next;
    });
  };

  const sceneBriefEditor = sceneBriefDefaults ? (
          <SceneBriefDialog embedded
            defaults={sceneBriefDefaults}
            providerMode={configuredProviderMode}
            livePreflight={configuredProviderStatus?.livePreflight ?? null}
            inheritedContext={(() => {
              const scene = cinema && Object.values(cinema.scenes).find((item) => item.nodeId === sceneBriefDefaults.sceneNodeId);
              if (!cinema?.storyWorkflow || !scene) return undefined;
              const manifest = reviewStoryReferenceTransfer(cinema, { kind: 'scene', id: scene.id }, 'shot-planning', { maxImages: 8, maxBytes: 12 * 1024 * 1024, maxNoteCharacters: 10_000 });
              const direction = inheritedStoryDirection({ schemaVersion: 5, title, nodes, edges, cinema, updatedAt: 0 }, scene.id);
              return { notes: manifest.ready ? manifest.included.flatMap((item) => item.current.content.kind === 'note' ? [`${item.current.title}: ${item.current.content.text}`] : []) : [],
                excluded: [...manifest.blockers, ...manifest.excluded.map((item) => `Reference excluded: ${item.reason}`), ...manifest.included.filter((item) => item.current.content.kind === 'image').map((item) => `${item.current.title}: image pixels are not sent by the text-based shot planner; they remain available to image generation if separately permitted.`)],
                directionLabel: direction ? `Inherited brief v${direction.brief.version}, ${direction.allocation}s allocated` : undefined };
            })()}
            onCancel={closeSceneBrief}
            onSubmit={(brief, liveProviderConsent) => {
              closeLayerEditor();
              runMockScene(brief, liveProviderConsent);
            }}
          />
        ) : null;
  const expandedLayerEditor = layerEditorId && layerTarget && layerTarget.role !== 'story' ? <LayerEditorShell nodeId={layerEditorId} title={layerTarget.role === 'scene' ? 'Scene' : 'Shot'} onClose={closeLayerEditor}>
          {sceneBriefDefaults?.sceneNodeId === layerEditorId ? sceneBriefEditor : layerReferencesOpen && cinema ? <>
            <button type="button" onClick={() => setLayerReferencesOpen(false)}>Back to layer</button>
            <StoryDevelopmentPanel embedded referencesOnly open document={layerDocument} getDocument={getCurrentDocument}
              commit={commitLayerDocument} flush={() => queueDocumentSave(getCurrentDocument())} onClose={() => setLayerReferencesOpen(false)}
              owner={layerReferenceOwner} />
          </> : <>
          {layerEditorError && <p role="alert">{layerEditorError}</p>}
          <details open={layerTarget.role !== 'shot' || !layerTarget.shot} className="layer-metadata"><summary>Edit {layerTarget.role} details</summary><LayerEditorFields document={layerDocument} nodeId={layerEditorId}
            onText={(patch) => changeLayer((document) => editLayerText(document, layerEditorId, patch))}
            onShot={(patch) => changeLayer((document) => editLayerShot(document, layerEditorId, patch))} /></details>
          {layerTarget.role === 'scene' && <section className="layer-editor-next">
            {(() => { const inherited = inheritedStoryDirection(layerDocument, layerTarget.scene?.id ?? layerEditorId);
              return inherited ? <p>Inherited direction: brief v{inherited.brief.version} · {inherited.allocation}s allocated · {inherited.brief.tone}. Overrides are reviewed in shot-plan setup; sibling scenes stay unchanged.</p> : <p>Set duration, format and production constraints in shot-plan review.</p>; })()}
            <button type="button" className="primary-button" disabled={layerTarget.readOnly || mockProposalStage !== 'idle' || configuredProviderMode === 'loading'} onClick={() => planMockScene(layerEditorId ?? undefined)}>Review shot plan</button>
          </section>}
          {!layerTarget.readOnly && storyEnabled && <button type="button" onClick={() => {
            try {
              const next = ensureStoryProject(getCurrentDocument());
              const target = layerEditTarget(next, layerEditorId)!;
              const parentId = target.role === 'shot' && !target.shot
                ? cinemaHierarchyParentId(next.nodes, next.edges, layerEditorId, 'scene') : null;
              const scene = target.scene ?? Object.values(next.cinema!.scenes).find((scene) => scene.nodeId === parentId);
              const owner: StoryReferenceOwner = target.shot ? { kind: 'shot', id: target.shot.id }
                : scene ? { kind: 'scene', id: scene.id } : { kind: 'story', id: next.cinema!.projectId };
              commitLayerDocument(next);
              setLayerReferenceOwner(owner);
              setLayerEditorError('');
              setLayerReferencesOpen(true);
            } catch (error) { setLayerEditorError((error as Error).message); }
          }}>Review inherited references</button>}
          {layerTarget.shot && cinema && <section className="layer-editor-media" aria-label="Shot media workbench"><h3>{layerTarget.shot.title}</h3>
            <ShotMediaPreview cinema={cinema} shot={layerTarget.shot} />
            <p>Existing consent, approved-frame and provider capability checks apply. Opening these controls does not generate.</p>
            <fieldset disabled={layerTarget.readOnly}><VisualPreproductionPanel key={JSON.stringify([visualOwnerEpoch, cinema.projectId, layerTarget.shot.id])} cinema={cinema} sceneId={layerTarget.shot.sceneId} shot={layerTarget.shot} accepted={true}
              capabilities={workspaceCapabilities.value} onCleanupMedia={cleanupUnusedMedia}
              onUpdate={updateVisualPreproduction} onNotice={announce}
              canvasImages={presentedNodes.flatMap((node) => node.data.kind === 'raster' ? [{ nodeId: node.id, name: node.data.name, fileName: node.data.fileName,
                src: node.data.src, width: node.data.naturalWidth, height: node.data.naturalHeight }] : [])} /></fieldset>
          </section>}
          {layerTarget.role === 'shot' && !layerTarget.shot && <p>Manual shot draft. Review its parent scene’s shot plan to create structured generation inputs. No media is generated automatically.</p>}
          {!layerTarget.readOnly && <InlineDiscardButton onConfirm={discardLayerChanges} />}
          <p role="status">{saveState === 'saved' ? 'Saved on this device' : saveState === 'error' ? 'Not saved — keep this tab open and retry a backup.' : 'Saving locally…'}</p>
          </>}
        </LayerEditorShell> : null;

  return (
    <CinemaMediaContext.Provider value={cinema ?? null}><StoryAssistantContext.Provider value={assistantProjection ? <StoryAssistantLayer controller={storyAssistant} document={layerDocument}
      capabilities={workspaceCapabilities.value}
      getDocument={getCurrentDocument} commit={commitStoryDocument} flush={() => queueDocumentSave(getCurrentDocument())}
      providerMode={configuredProviderMode}
      onScenesAccepted={revealAcceptedScenes}
      shotPlanning={<AssistantShotPlanning document={layerDocument} getDocument={getCurrentDocument} commit={commitStoryDocument} flush={() => queueDocumentSave(getCurrentDocument())}
        capabilities={workspaceCapabilities.value}
        onReviewSequence={filmmaking.enabled ? () => filmmaking.select('final-cut') : undefined}
        providerMode={configuredProviderMode} reviewOnOpen={filmmaking.enabled && expandedShotSetup === acceptedSession?.id}
        onExpand={() => { setExpandedShotSetup(acceptedSession?.id ?? null); setAssistantOpenEpoch((value) => value + 1); }} onOpenLayer={(id) => { storyAssistant.change((value) => { value.collapsed = true; }); setWorkspaceView('canvas'); openLayerEditor(id); }} />}
      onPlanScene={(id) => { storyAssistant.change((value) => { value.collapsed = true; }); setWorkspaceView('canvas'); openLayerEditor(id); }} /> : null}>
    <ExpandedStoryContext.Provider value={layerEditorId ? { nodeId: layerEditorId, editor: expandedStoryId ?
      <ExpandedPremiseNode nodeId={expandedStoryId} onClose={closeLayerEditor}>
        <PremiseLayerEditor document={layerDocument} nodeId={expandedStoryId} getDocument={getCurrentDocument}
          commit={commitLayerDocument} flush={() => queueDocumentSave(getCurrentDocument())} onClose={closeLayerEditor}
          onDiscard={discardLayerChanges} saveState={saveState} error={layerEditorError} onDevelop={openStoryAssistant} />
      </ExpandedPremiseNode> : expandedLayerEditor,
    } : null}>
    <SelectedNodeCountContext.Provider value={selectedNodeCount}>
      <CinemaProjectContext.Provider value={cinemaOutlineActive ? activeCinemaProject : null}>
        <ProposedNodeIdsContext.Provider value={previewNodeIds}>
          <NodeActionContext.Provider value={nodeActionValue}>
        {writer === 'reader' && <div className="document-reader-banner" role="alert">This tab is read-only: another editor owns this local document, or safe browser locking is unavailable. Close the other editor, then <button type="button" onClick={() => window.location.reload()}>Reload to edit</button>. Your saved work is unchanged.</div>}
        {replacingDocument && <div className="document-reader-banner" role="status">Replacing the local project safely. Editing resumes when storage finishes.</div>}
        <main
        inert={writer !== 'writer' || !hydrated || replacingDocument}
        className={`editor-shell cinema-outline-active ${filmmaking.enabled ? `simplified-flow stage-${filmmaking.stage}` : ''} ${(filmmaking.enabled ? simplifiedInspectorOpen : inspectorOpen) ? '' : 'inspector-closed'}`}
        aria-label={APP_CONFIG.editorAriaLabel}
        aria-busy={!hydrated || replacingDocument}
        data-ready={hydrated && writer !== 'pending' ? 'true' : 'false'}
        data-save-state={saveState}
      >
        <a href="#canvas-workspace" className="skip-link">Skip to canvas</a>
        <header className="topbar">
          <div className="brand" aria-label={APP_CONFIG.name}>
            <span className="brand-mark" aria-hidden="true">{APP_CONFIG.shortMark}</span>
            <span>{APP_CONFIG.name}</span>
          </div>
          <label className="document-title">
            <span className={`status-dot status-${saveState}`} aria-hidden="true" />
            <span className="visually-hidden">Document title</span>
            <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
            <span className="save-label" aria-live="polite">
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved on device'}
            </span>
          </label>
          {filmmaking.enabled ? <FilmmakingNavigation stage={filmmaking.stage} recommendedStage={stageProjection.recommendedStage} onSelect={(stage) => {
            filmmaking.select(stage); setShotDetailOpen(false); setWorkspaceView('canvas');
          }} /> : mockPlanAccepted && !mockProposalPreview ? <div className="editor-view-switch" role="group" aria-label="Workspace view">
            <button type="button" className={workspaceView === 'canvas' ? 'active' : ''} aria-pressed={workspaceView === 'canvas'} onClick={() => setWorkspaceView('canvas')}>Canvas</button>
            <button type="button" className={workspaceView === 'project' ? 'active' : ''} aria-pressed={workspaceView === 'project'} onClick={() => setWorkspaceView('project')}>Project</button>
            <button type="button" className={workspaceView === 'table' ? 'active' : ''} aria-pressed={workspaceView === 'table'} onClick={() => setWorkspaceView('table')}>Shot table</button>
            <button type="button" className={workspaceView === 'board' ? 'active' : ''} aria-pressed={workspaceView === 'board'} onClick={() => setWorkspaceView('board')}>Board</button>
          </div> : null}
          <div className="topbar-actions">
            {filmmaking.enabled ? <>
              <WorkspaceStatus state={workspaceCapabilities} onRefresh={() => void workspaceCapabilities.refresh()} onDiagnostics={() => setTraceOpen(true)} />
              <details className="simplified-advanced"><summary>Advanced</summary><div>
                <button type="button" onClick={() => { filmmaking.select('idea'); setWorkspaceView('canvas'); setShotDetailOpen(true); }}>Canvas</button>
                {mockPlanAccepted && !mockProposalPreview && <>
                  <button type="button" onClick={() => { filmmaking.select('plan'); setWorkspaceView('project'); setShotDetailOpen(true); }}>Production overview</button>
                  <button type="button" onClick={() => { filmmaking.select('plan'); setWorkspaceView('table'); setShotDetailOpen(true); }}>Shot table</button>
                  <button type="button" onClick={() => { filmmaking.select('plan'); setWorkspaceView('board'); setShotDetailOpen(true); }}>Board</button>
                </>}
                <button type="button" onClick={() => void switchWorkspacePreview(false)}>Original workspace</button>
              </div></details>
            </> : <button type="button" className="ghost-button workspace-preview-button" onClick={() => void switchWorkspacePreview(true)}>Try simplified flow</button>}
            <button
              type="button"
              className={`provider-mode-badge desktop-provider-mode mode-${configuredProviderMode === 'live' ? 'live' : 'fixture'}`}
              aria-label={configuredProviderMode === 'loading'
                ? `${workspaceCapabilities.status === 'error' ? 'Provider availability unknown' : 'Provider status loading'}. Open provider status and local traces.`
                : `${configuredProviderMode} provider mode. Open provider status and local traces.`}
              onClick={() => setTraceOpen(true)}
            >
              {configuredProviderMode === 'live' ? 'Live mode' : configuredProviderMode === 'fixture' ? 'Fixture mode' : workspaceCapabilities.status === 'error' ? 'Availability unknown' : 'Checking…'}
            </button>
            <button
              type="button"
              className="icon-button mobile-layers-button"
              aria-label="Open layers panel"
              aria-expanded={mobilePanel === 'layers'}
              onClick={() => setMobilePanel((current) => current === 'layers' ? null : 'layers')}
            >
              <Layers3 size={16} />
            </button>
            <button
              type="button"
              className="icon-button desktop-inspector-button"
              aria-label="Toggle properties panel"
              aria-expanded={filmmaking.enabled ? simplifiedInspectorOpen : inspectorOpen}
              onClick={() => filmmaking.enabled ? setSimplifiedInspectorOpen((current) => !current) : setInspectorOpen((current) => !current)}
            >
              <SlidersHorizontal size={16} />
            </button>
            <button
              type="button"
              className="icon-button mobile-inspector-button"
              aria-label="Open properties panel"
              aria-expanded={mobilePanel === 'inspector'}
              onClick={() => setMobilePanel((current) => current === 'inspector' ? null : 'inspector')}
            >
              <SlidersHorizontal size={16} />
            </button>
            {storyEnabled && <button type="button" className="ghost-button story-entry-button" aria-label="Open story assistant" disabled={Boolean(mockProposalPreview)} onClick={openStoryAssistant}><Sparkles size={14} />Assistant</button>}
            <button type="button" className="icon-button backup-button" aria-label="Project backup and restore" onClick={openBackup}>
              <HardDrive size={16} />
            </button>
            <button type="button" className="ghost-button new-button" onClick={() => void resetDocument()}>
              <RotateCcw size={14} /> New
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Undo"
              onClick={undo}
              disabled={!hydrated || !historyState.canUndo}
              suppressHydrationWarning
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Redo"
              onClick={redo}
              disabled={!hydrated || !historyState.canRedo}
              suppressHydrationWarning
            >
              <Redo2 size={16} />
            </button>
            <button type="button" className={filmmaking.enabled ? 'secondary-button' : 'primary-button'} aria-label="Export SVG" onClick={openExport}>
              <Download size={14} /> <span className="button-label">Export SVG</span>
            </button>
            <ProjectActionsMenu
              providerMode={configuredProviderMode}
              onBackup={openBackup}
              onNew={() => void resetDocument()}
              onExport={openExport}
              onTrySimplified={filmmaking.enabled ? undefined : () => void switchWorkspacePreview(true)}
            />
          </div>
        </header>

        <aside className={`panel layers-panel ${mobilePanel === 'layers' ? 'panel-open' : ''}`} aria-labelledby="layers-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{layerPanelMode === 'outline' ? 'Project' : 'Document'}</span>
              <h1 id="layers-title">{layerPanelMode === 'outline' ? 'Project Outline' : 'Layers'}</h1>
            </div>
            <div className="panel-heading-actions">
              {layerPanelMode === 'outline' ? <button type="button" className="icon-button" aria-label="Add filmmaking layer" disabled={Boolean(mockProposalPreview)} onClick={addConceptNode}><Plus size={16} /></button> : null}
              <button type="button" className="icon-button panel-close-button" aria-label="Close layers panel" onClick={() => setMobilePanel(null)}><X size={16} /></button>
            </div>
          </div>
          <div className="layer-view-switch" role="group" aria-label="Project sidebar view">
            <button
              type="button"
              aria-pressed={layerPanelMode === 'outline'}
              onClick={() => setLayerPanelMode('outline')}
            >Project Outline</button>
            <button
              type="button"
              aria-pressed={layerPanelMode === 'layers'}
              onClick={() => setLayerPanelMode('layers')}
            >Layers</button>
          </div>
          <div className="layer-search">
            <Search size={13} aria-hidden="true" />
            <label htmlFor="layer-search-input" className="visually-hidden">{layerPanelMode === 'outline' ? 'Search project outline' : 'Search layers and concept text'}</label>
            <input
              id="layer-search-input"
              type="search"
              placeholder={layerPanelMode === 'outline' ? 'Search scenes, assets, shots' : 'Search layers and notes'}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                const firstScene = cinemaOutlineModel.scenes[0];
                const firstOutlineNode = firstScene?.groups[0]?.items[0]?.nodeId
                  ?? firstScene?.item.nodeId
                  ?? cinemaOutlineModel.project?.nodeId;
                if (layerPanelMode === 'outline' && firstOutlineNode) handleOutlineSelection(firstOutlineNode);
                else if (sidebarLayerNodes[0]) revealAndSelectNode(sidebarLayerNodes[0].id);
              }}
            />
            {normalizedSearch ? <span aria-live="polite">{layerPanelMode === 'outline' ? cinemaOutlineModel.visibleItemCount : layerNodes.length}</span> : null}
          </div>
          {layerPanelMode === 'outline' && !mockProposalPreview ? <div className="cinema-add-entry">
            <span><strong>Build your project</strong><small>Add a typed scene, shot, character, asset, or note.</small></span>
            <button type="button" onClick={addConceptNode}><Plus size={12} /> Add</button>
          </div> : null}
          <p id="layer-list-instructions" className="visually-hidden">
            {layerPanelMode === 'outline'
              ? 'Project Outline is generated automatically from validated canvas connections and production records. Draft, proposed, and accepted items remain in one hierarchy.'
              : 'Layers shows the flat canvas stacking order. Double-click an unlocked layer or press F2 while it is focused to rename it.'}
          </p>
          {layerPanelMode === 'outline' ? (
            <UnifiedProjectOutline
              model={cinemaOutlineModel}
              selectedNodeId={selectedNodeId}
              collapsedBranches={collapsedOutlineBranches}
              proposalPreview={Boolean(mockProposalPreview)}
              searchActive={Boolean(normalizedSearch)}
              onToggleBranch={toggleOutlineBranch}
              onSelectNode={(id, additive) => {
                if (filmmaking.enabled && !canvasVisible) {
                  const target = layerEditTarget(getCurrentDocument(), id);
                  filmmaking.select(target?.role === 'story' ? 'idea' : target?.role === 'shot' ? 'references' : 'plan');
                  setShotDetailOpen(true);
                  if (target) openLayerEditor(id);
                }
                handleOutlineSelection(id, additive);
              }}
              onFocusNodes={(ids) => {
                if (filmmaking.enabled && !canvasVisible) {
                  filmmaking.select('plan'); setShotDetailOpen(true);
                  window.setTimeout(() => focusOutlineNodes(ids), 0);
                } else focusOutlineNodes(ids);
              }}
              onAddToScene={openSceneCreationPalette}
              onToggleVisibility={toggleNodeVisibility}
              onToggleLock={toggleNodeLock}
            />
          ) : <ul
            className="layer-list"
            aria-label="Canvas layers"
            aria-describedby="layer-list-instructions"
          >
            {sidebarLayerNodes.map((node) => {
              const expanded = expandedVectors.has(node.id);
              const cinemaDetail = cinemaNodeIds.has(node.id) ? activeCinemaProject.nodes[node.id] : undefined;
              const draftRole = node.data.kind === 'concept'
                ? cinemaDraftRole(node.data.domainType, node.data.eyebrow)
                : null;
              const draftDescriptor = draftRole ? cinemaDraftDescriptor(draftRole) : null;
              return (
                <Fragment key={node.id}>
                  <li>
                  <div className={`layer-row ${node.selected ? 'active' : ''} ${previewNodeIds.has(node.id) ? 'proposed' : ''}`}>
                    {node.data.kind === 'vector' ? (
                      <button
                        type="button"
                        className="layer-disclosure"
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.data.name}`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedVectors((current) => {
                          const next = new Set(current);
                          if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
                          return next;
                        })}
                      >{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
                    ) : <span className="layer-indent" />}
                    {renamingLayerId === node.id ? (
                      <div className="layer-main layer-renaming">
                        <span className="layer-icon" aria-hidden="true">
                          {cinemaDetail
                            ? <span className={`cinema-layer-glyph kind-${cinemaDetail.kind}`} data-glyph={cinemaDetail.kind === 'agent-run' ? 'AI' : cinemaDetail.kind.slice(0, 1).toUpperCase()} />
                            : draftDescriptor
                              ? <span className={`cinema-layer-glyph role-${draftDescriptor.role}`} data-glyph={draftDescriptor.label.slice(0, 1)} />
                            : node.data.kind === 'raster' ? <ImageIcon size={12} /> : node.data.kind === 'vector' ? <Shapes size={12} /> : <Square size={11} />}
                        </span>
                        <input
                          aria-label="Layer name"
                          value={node.data.name}
                          maxLength={240}
                          autoFocus
                          onChange={(event) => updateNode(node.id, (current) => ({
                            ...current,
                            data: { ...current.data, name: event.target.value },
                          }), false)}
                          onBlur={() => {
                            endFieldEdit();
                            setRenamingLayerId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                              window.setTimeout(() => {
                                const layer = [...document.querySelectorAll<HTMLElement>('[data-layer-id]')]
                                  .find((element) => element.dataset.layerId === node.id);
                                layer?.focus();
                              }, 0);
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              cancelFieldEdit();
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="layer-main"
                        data-layer-id={node.id}
                        aria-pressed={node.selected === true}
                        onClick={(event) => handleLayerSelection(event, node.id)}
                        onKeyDown={(event) => {
                          if (event.key !== 'F2' || node.data.locked) return;
                          event.preventDefault();
                          beginFieldEdit();
                          setRenamingLayerId(node.id);
                        }}
                        onDoubleClick={() => {
                          if (node.data.locked) return;
                          beginFieldEdit();
                          setRenamingLayerId(node.id);
                        }}
                      >
                        <span className="layer-icon" aria-hidden="true">
                          {cinemaDetail
                            ? <span className={`cinema-layer-glyph kind-${cinemaDetail.kind}`} data-glyph={cinemaDetail.kind === 'agent-run' ? 'AI' : cinemaDetail.kind.slice(0, 1).toUpperCase()} />
                            : draftDescriptor
                              ? <span className={`cinema-layer-glyph role-${draftDescriptor.role}`} data-glyph={draftDescriptor.label.slice(0, 1)} />
                            : node.data.kind === 'raster' ? <ImageIcon size={12} /> : node.data.kind === 'vector' ? <Shapes size={12} /> : <Square size={11} />}
                        </span>
                        <span className="layer-name-group">
                          <span className="layer-name">{node.data.name}</span>
                        </span>
                      </button>
                    )}
                    <button type="button" className="layer-control" aria-label={`${node.hidden ? 'Show' : 'Hide'} ${node.data.name}`} onClick={() => toggleNodeVisibility(node.id)}>
                      {node.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button type="button" className="layer-control" aria-label={`${node.data.locked ? 'Unlock' : 'Lock'} ${node.data.name}`} onClick={() => toggleNodeLock(node.id)}>
                      {node.data.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                  </div>
                  {node.data.kind === 'vector' && expanded ? (
                    <ul className="path-list" aria-label={`${node.data.name} paths`}>
                      {node.data.paths.map((path) => (
                        <li key={path.id}>
                          <div className={`path-layer-row ${selectedPath?.pathId === path.id ? 'active' : ''}`}>
                            <button
                              type="button"
                              className="path-row"
                              aria-pressed={selectedPath?.pathId === path.id}
                              onClick={() => {
                                selectNode(node.id);
                                setSelectedPath({ nodeId: node.id, pathId: path.id });
                              }}
                            >
                              <span className="path-swatch" style={{ background: path.fill === 'none' ? 'transparent' : path.fill }} />
                              <span>{path.name}</span>
                            </button>
                            <button type="button" className="path-control" aria-label={`${path.visible ? 'Hide' : 'Show'} ${path.name}`} onClick={() => updatePathById(node.id, path.id, (current) => ({ ...current, visible: !current.visible }))}>
                              {path.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                            </button>
                            <button type="button" className="path-control" aria-label={`${path.locked ? 'Unlock' : 'Lock'} ${path.name}`} onClick={() => updatePathById(node.id, path.id, (current) => ({ ...current, locked: !current.locked }))}>
                              {path.locked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  </li>
                </Fragment>
              );
            })}
          </ul>}
          <div className="local-note">
            <span className="local-note-icon" aria-hidden="true"><Check size={11} /></span>
            <div><strong>Local workspace</strong><span>Images and edits stay on this device</span></div>
          </div>
        </aside>

        <section
          id="canvas-workspace"
          className={`canvas-region tool-${toolMode} ${layerEditorId || (assistantProjection && !assistantState?.hidden && !assistantState?.collapsed) ? 'editor-active' : ''} ${dragActive ? 'drag-active' : ''} ${temporaryPanActive ? 'temporary-pan' : ''} ${selectedNodeCount > 1 ? 'multi-selection-active' : ''}`}
          aria-label="Canvas workspace"
          tabIndex={-1}
          onPointerDownCapture={(event) => {
            if (event.button !== 0) return;
            // XYFlow resets selection before its onSelectionStart callback.
            // This is a gesture origin, not a second document snapshot.
            selectionOriginRef.current = new Set(nodesRef.current.filter(node => node.selected).map(node => node.id));
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!canvasVisible || mockProposalPreview) return;
            dragDepthRef.current += 1;
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = canvasVisible ? 'copy' : 'none';
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!canvasVisible || mockProposalPreview) return;
            dragDepthRef.current = 0;
            setDragActive(false);
            void ingestFiles(Array.from(event.dataTransfer.files), { x: event.clientX, y: event.clientY });
          }}
          onDoubleClick={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!canvasVisible || mockProposalPreview || toolMode !== 'select' || !target?.classList.contains('react-flow__pane')) return;
            event.preventDefault();
            addConceptAt({ x: event.clientX, y: event.clientY }, true);
          }}
        >
          {filmmaking.enabled && <WorkspaceGuide guidance={stageProjection.guidance[filmmaking.stage]}
            workbenchOwnsAction={filmmaking.stage === 'final-cut' || filmmaking.stage === 'idea' && Boolean(expandedStoryId || assistantVisible)
              || filmmaking.stage === 'plan' && Boolean(!layerEditorId && assistantVisible && !assistantState?.collapsed)
              || (filmmaking.stage === 'references' || filmmaking.stage === 'video') && shotDetailOpen}
            onAction={applyStageAction} onOverview={() => { setShotDetailOpen(false); setWorkspaceView('canvas'); }} />}
          {filmmaking.enabled && <ProjectOperationSummary projectId={cinema?.projectId} onOpen={(workspace) => {
            filmmaking.select(workspace); setShotDetailOpen(false); setWorkspaceView('canvas');
          }} />}
          {filmmaking.enabled && <div className="simplified-surface" hidden={!['references', 'video'].includes(filmmaking.stage) || shotDetailOpen}>
            <ShotsOverview stage={filmmaking.stage === 'video' ? 'video' : 'references'} cinema={cinema} onPlan={() => filmmaking.select('plan')}
              onOpenScene={(id) => { const nodeId = cinema?.scenes[id]?.nodeId; if (nodeId) openSimplifiedLayer(nodeId); }}
              onOpenShot={openSimplifiedLayer}
              renderPreview={(shot) => cinema ? <ShotMediaPreview cinema={cinema} shot={shot} emptyDescription="Open this shot to review image settings and generate a storyboard." /> : null} />
          </div>}
          {filmmaking.enabled && <div className="simplified-surface" hidden={filmmaking.stage !== 'final-cut'}>
            <div className="simplified-edit">{cinema ? <SequenceReview key={JSON.stringify([visualOwnerEpoch, cinema.projectId])} cinema={cinema} capabilities={workspaceCapabilities.value} onNotice={announce} /> : <div className="workspace-empty"><h3>Your cut starts with a story</h3><p>Accept a shot plan and approve takes before rendering.</p><button type="button" onClick={() => filmmaking.select('plan')}>Go to Plan</button></div>}</div>
          </div>}
          {(!filmmaking.enabled || filmmaking.stage === 'plan') && workspaceView === 'project' && cinema && mockPlanAccepted && !mockProposalPreview ? <ProjectProductionWorkspace
            cinema={cinema}
            onCommand={applyProfessionalPlanningCommand}
            onOpenScene={openProjectScene}
            onNotice={announce}
          /> : null}
          {(!filmmaking.enabled || filmmaking.stage === 'plan') && (workspaceView === 'table' || workspaceView === 'board') && cinema && mockPlanAccepted && !mockProposalPreview ? <ProfessionalPlanningWorkspace
            cinema={cinema}
            view={workspaceView}
            onViewChange={setWorkspaceView}
            onCommand={applyProfessionalPlanningCommand}
            onSelectShot={selectProfessionalShot}
            onNotice={announce}
          /> : null}
          <ReactFlow<EditorNode, EditorEdge>
            hidden={filmmaking.enabled && (filmmaking.stage === 'final-cut' || (filmmaking.stage === 'references' || filmmaking.stage === 'video') && !shotDetailOpen)}
            className={workspaceView === 'canvas' ? '' : 'workspace-canvas-hidden'}
            nodes={assistantProjection ? [...canvasNodes, assistantProjection.node] : canvasNodes}
            edges={assistantProjection ? [...canvasEdges, assistantProjection.edge] : canvasEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={(event, node) => {
              if (node.type === 'storyAssistant' || mockProposalPreview || toolMode !== 'select' || temporaryPanActive) return;
              if (selectedNodeCount > 1 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                selectNode(node.id);
                layerSelectionAnchorRef.current = node.id;
              }
            }}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onBeforeDelete={handleBeforeDelete}
            isValidConnection={isValidConnection}
            onNodeDragStart={() => {
              if (mockProposalPreview) return;
              dragOriginRef.current = cloneSnapshot(nodesRef.current, edgesRef.current, cinemaRef.current);
            }}
            onNodeDragStop={() => {
              if (mockProposalPreview) return;
              if (dragOriginRef.current) {
                recordHistory(dragOriginRef.current);
                dragOriginRef.current = null;
              }
            }}
            onSelectionStart={handleSelectionStart}
            onSelectionEnd={handleSelectionEnd}
            onPaneClick={() => setSelectedPath(null)}
            onMove={(_, viewport) => setViewportZoom(viewport.zoom)}
            fitView={false}
            minZoom={0.15}
            maxZoom={4}
            panOnDrag={toolMode === 'hand' ? true : [1]}
            panActivationKeyCode="Space"
            panOnScroll
            zoomOnScroll={false}
            zoomActivationKeyCode={['Meta', 'Control']}
            zoomOnPinch
            zoomOnDoubleClick={false}
            selectionOnDrag={toolMode === 'select' && !mockProposalPreview}
            selectionMode={SelectionMode.Partial}
            selectionKeyCode={['Meta', 'Control']}
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            paneClickDistance={5}
            nodeClickDistance={3}
            autoPanOnSelection
            autoPanOnNodeDrag
            autoPanOnConnect
            nodesDraggable={toolMode === 'select' && !temporaryPanActive && !mockProposalPreview}
            nodesFocusable
            autoPanOnNodeFocus={!layerEditorId}
            edgesFocusable
            selectNodesOnDrag={toolMode === 'select' && !temporaryPanActive}
            deleteKeyCode={!canvasVisible || mockProposalPreview ? null : ['Backspace', 'Delete']}
            ariaLabelConfig={{
              'controls.ariaLabel': 'Canvas controls',
              'minimap.ariaLabel': 'Diagram overview',
            }}
          >
            <Background color="#d8dbe2" gap={18} size={1} />
            <NodeToolbar
              nodeId={selectedNodes.map((node) => node.id)}
              isVisible={selectedNodeCount > 1}
              position={Position.Top}
              offset={18}
            >
              <CanvasBoundActionbar
                className="multi-node-actionbar nodrag nowheel"
                role="group"
                aria-label={`${selectedNodeCount} selected layer actions`}
              >
                <span className="multi-node-count"><Layers3 size={14} /> {selectedNodeCount} selected</span>
                <button
                  type="button"
                  aria-label="Duplicate selected layers"
                  title="Duplicate selected layers"
                  disabled={selectedUnlockedCount === 0}
                  onClick={duplicateSelectedNodes}
                ><Copy size={14} /></button>
                <button
                  type="button"
                  aria-label="Align selected layers left"
                  title="Align left"
                  disabled={selectedUnlockedCount < 2}
                  onClick={() => alignSelectedNodes('left')}
                ><AlignHorizontalJustifyStart size={14} /></button>
                <button
                  type="button"
                  aria-label="Align selected layers top"
                  title="Align top"
                  disabled={selectedUnlockedCount < 2}
                  onClick={() => alignSelectedNodes('top')}
                ><AlignVerticalJustifyStart size={14} /></button>
                <button
                  type="button"
                  aria-label="Distribute selected layers horizontally"
                  title="Distribute horizontally"
                  disabled={selectedUnlockedCount < 3}
                  onClick={() => alignSelectedNodes('horizontal')}
                ><AlignHorizontalSpaceBetween size={14} /></button>
                <button
                  type="button"
                  aria-label="Distribute selected layers vertically"
                  title="Distribute vertically"
                  disabled={selectedUnlockedCount < 3}
                  onClick={() => alignSelectedNodes('vertical')}
                ><AlignVerticalSpaceBetween size={14} /></button>
                <button
                  type="button"
                  aria-label={selectedUnlockedCount === 0 ? 'Unlock selected layers' : 'Lock selected layers'}
                  title={selectedUnlockedCount === 0 ? 'Unlock selected layers' : 'Lock selected layers'}
                  onClick={() => setSelectedNodesLocked(selectedUnlockedCount > 0)}
                >{selectedUnlockedCount === 0 ? <Unlock size={14} /> : <Lock size={14} />}</button>
                <button
                  type="button"
                  className="danger"
                  aria-label="Delete unlocked selected layers"
                  title="Delete unlocked selected layers"
                  disabled={selectedUnlockedCount === 0}
                  onClick={deleteSelectedNodes}
                ><Trash2 size={14} /></button>
              </CanvasBoundActionbar>
            </NodeToolbar>
            <CanvasZoomGestures />
            <Controls position="bottom-right" showInteractive={false} fitViewOptions={{ nodes: nodes.map(({ id }) => ({ id })), padding: 0.22 }} />
            {nodesInitialized && !layerEditorId && (!assistantProjection || cinema?.storyWorkflow?.assistant?.hidden) && <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeColor={(node) => node.type === 'storyAssistant' ? 'transparent' : node.type === 'raster' ? '#d8dbe2' : node.type === 'vector' ? '#635bff' : '#8a8e98'}
            />}
            <Panel position="top-center" className="canvas-toolbar" aria-label="Canvas tools">
              <button type="button" className={`tool ${toolMode === 'select' && !temporaryPanActive ? 'active' : ''}`} aria-label="Select tool, V" aria-pressed={toolMode === 'select' && !temporaryPanActive} title="Select layers (V) · Drag empty canvas to select" onClick={() => setToolMode('select')}><MousePointer2 size={16} /></button>
              <button type="button" className={`tool ${toolMode === 'hand' || temporaryPanActive ? 'active' : ''}`} aria-label="Hand tool, H" aria-pressed={toolMode === 'hand' || temporaryPanActive} title="Pan canvas (H) · Hold Space from Select" onClick={() => setToolMode('hand')}><Hand size={16} /></button>
              <span className="toolbar-divider" />
              {assistantProjection && <button type="button" className="tool" aria-label="Focus story assistant" onClick={() => { storyAssistant.change((value) => { value.hidden = false; }); focusStoryAssistant(); }}><Focus size={16} /></button>}
              <button type="button" className="tool" aria-label="Add filmmaking layer" disabled={Boolean(mockProposalPreview)} onClick={addConceptNode}><TypeIcon size={16} /></button>
              <button type="button" className="tool" aria-label="Connect nodes by dragging their handles" disabled={Boolean(mockProposalPreview)} onClick={() => announce('Drag from a node handle to another node to create a connector.')}><Waypoints size={16} /></button>
              <button type="button" className="tool" aria-label="Reorganize project layout" title="Reorganize project layout" disabled={Boolean(mockProposalPreview)} onClick={tidyDiagram}><Sparkles size={16} /></button>
              {layerEditorId ? <button type="button" className="tool" aria-label={expandedStoryId ? 'Focus story editor' : 'Focus layer editor'} title="Fit expanded layer into view" onClick={focusExpandedStory}><Focus size={16} /></button>
                : <button type="button" className="tool" aria-label="Import image" disabled={Boolean(mockProposalPreview)} onClick={() => fileInputRef.current?.click()}><Upload size={16} /></button>}
            </Panel>
            <Panel position="bottom-right" className="zoom-readout">
              <button
                type="button"
                aria-label={`Reset zoom to 100%, currently ${Math.round(viewportZoom * 100)}%`}
                title="Reset zoom to 100%"
                onClick={() => {
                  const viewport = getViewport();
                  const canvasBounds = document.querySelector<HTMLElement>('.canvas-region .react-flow')?.getBoundingClientRect();
                  const center = screenToFlowPosition({
                    x: canvasBounds ? canvasBounds.left + canvasBounds.width / 2 : window.innerWidth / 2,
                    y: canvasBounds ? canvasBounds.top + canvasBounds.height / 2 : window.innerHeight / 2,
                  });
                  void setCenter(center.x, center.y, { zoom: 1, duration: 180 });
                  if (viewport.zoom === 1) setViewportZoom(1);
                }}
              >{Math.round(viewportZoom * 100)}%</button>
            </Panel>
            {!layerEditorId && (!assistantProjection || cinema?.storyWorkflow?.assistant?.hidden || cinema?.storyWorkflow?.assistant?.collapsed) && !mockProposalPreview && mockProposalStage !== 'planning' && nodes.length > 0 ? <Panel position="bottom-center" className="drop-prompt">
              <span className="upload-symbol" aria-hidden="true"><Upload size={16} /></span>
              <div><strong>Drop an image anywhere</strong><span>or paste with ⌘V</span></div>
              <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>Browse files</button>
            </Panel> : null}
            {mockProposalStage === 'planning' ? <Panel position="bottom-center" className="planning-progress" role="status" aria-label="Shot planning progress">
              <LoaderCircle className="spin" size={16} />
              <div><strong>Generating shot plan</strong><span>Researching → planning shots → validating proposal</span></div>
              <button type="button" className="secondary-button" onClick={() => planningControllerRef.current?.abort('creator-cancelled')}>Cancel</button>
            </Panel> : null}
          </ReactFlow>
          {workspaceView === 'canvas' && nodes.length === 0 && !mockProposalPreview && mockProposalStage !== 'planning' ? (
            <EmptyCanvasRecovery
              canUndo={historyState.canUndo}
              hasRecovery={Boolean(recoveryDocument)}
              onUndo={undo}
              onRecover={() => void recoverLastNonEmptyCanvas()}
              onStartScene={chooseStartScene}
              onStartIdea={chooseStartIdea}
              onAdd={() => setCreationPaletteOpen(true)}
              onRestore={openBackup}
              onExploreSample={chooseSampleProject}
            />
          ) : null}
          {workspaceView === 'canvas' && mockProposalStage === 'planning' ? (
            <div className="mock-planning-card" role="status">
              <span className="mock-planning-icon"><LoaderCircle className="spin" size={18} /></span>
              <div>
                <strong>Generating shot plan</strong>
                <span>Research → continuity elements → shots → validated cost range</span>
              </div>
            </div>
          ) : null}
          {workspaceView === 'canvas' && mockProposalPreview ? (
            <section className="proposal-review-bar" aria-label="Shot proposal review">
              <div className="proposal-review-icon" aria-hidden="true"><Sparkles size={16} /></div>
              <div className="proposal-review-copy">
                <span>{proposalMode === 'live' ? 'Live shot plan ready' : 'Fixture shot plan ready'}</span>
                <strong>{activeCinemaProject.shotNodeIds.length} shots · {activeCinemaProject.targetDurationSeconds} sec · {formatCinemaCost(activeCinemaProject.cost.expected, activeCinemaProject.cost.pricingMode, activeCinemaProject.cost.currency)} expected</strong>
                <small>Inspect every ghost node before committing one undoable change.</small>
              </div>
              <div className="proposal-cost-range" aria-label="Illustrative cost range">
                <span><small>Minimum</small>{formatCinemaCost(activeCinemaProject.cost.minimum, activeCinemaProject.cost.pricingMode, activeCinemaProject.cost.currency)}</span>
                <span><small>High risk</small>{formatCinemaCost(activeCinemaProject.cost.highRisk, activeCinemaProject.cost.pricingMode, activeCinemaProject.cost.currency)}</span>
              </div>
              <div className="proposal-review-actions">
                <button type="button" className="secondary-button" onClick={rejectMockProposal}>Reject</button>
                <button type="button" className="primary-button" onClick={acceptMockProposal}><Check size={14} /> Accept plan</button>
              </div>
            </section>
          ) : null}
          {dragActive ? (
            <div className="drop-overlay" role="status">
              <Upload size={26} />
              <strong>Drop image to add</strong>
              <span>PNG, JPEG, or WebP · up to 15 MB</span>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            aria-label="Choose images to add to the canvas"
            accept="image/png,image/jpeg,image/webp"
            multiple
            disabled={Boolean(mockProposalPreview)}
            onChange={(event) => {
              void ingestFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </section>

        <aside className={`panel inspector-panel ${mobilePanel === 'inspector' ? 'panel-open' : ''}`} aria-labelledby="inspector-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Selection</span><h2 id="inspector-title">{selectedCinemaDetail ? 'Scene planner' : 'Properties'}</h2></div>
            <div className="panel-heading-actions">
              {selectedNodes.length > 1
                ? <span className="selection-kind">{selectedNodes.length} layers</span>
                : selectedEdge
                  ? <span className="selection-kind">connector</span>
                  : selectedNode
                    ? <span className="selection-kind">{selectedCinemaDetail?.kind ?? selectedNode.data.kind}</span>
                    : null}
              <button
                type="button"
                className="icon-button panel-close-button inspector-close-button"
                aria-label="Close properties panel"
                onClick={() => {
                  if (window.matchMedia('(max-width: 1020px)').matches) setMobilePanel(null);
                  else setInspectorOpen(false);
                }}
              ><X size={16} /></button>
            </div>
          </div>
          {layerEditorId ? <div className="empty-inspector"><strong>Editing on canvas</strong><span>Close the focused editor to use Properties.</span></div> : selectedVectorPath ? (
            <PathInspector
              path={selectedVectorPath.path}
              onUpdate={updateSelectedPath}
              onClose={() => setSelectedPath(null)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onMove={moveSelectedPath}
              onDuplicate={duplicateSelectedPath}
              onDelete={deleteSelectedPath}
            />
          ) : selectedEdge ? (
            <EdgeInspector
              edge={selectedEdge}
              onUpdate={(updater, shouldRecord) => updateEdge(selectedEdge.id, (edge) => {
                const next = updater(edge);
                const kind = next.data?.kind ?? 'default';
                const label = next.data?.label ?? '';
                return { ...next, label, style: connectorPresentation(kind) };
              }, shouldRecord)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onDelete={() => {
                recordHistory();
                setEdges((current) => current.filter((edge) => edge.id !== selectedEdge.id));
              }}
            />
          ) : selectedNodes.length > 1 ? (
            <MultiSelectionInspector
              count={selectedNodes.length}
              onTone={(tone) => updateSelectedNodes((node) => node.data.kind === 'concept'
                ? { ...node, data: { ...node.data, tone } }
                : node)}
              onOpacity={(opacity) => updateSelectedNodes((node) => ({ ...node, data: { ...node.data, opacity } }))}
              onAlign={alignSelectedNodes}
              onDuplicate={duplicateSelectedNodes}
              onLock={() => setSelectedNodesLocked(true)}
              onUnlock={() => setSelectedNodesLocked(false)}
              onDelete={deleteSelectedNodes}
            />
          ) : selectedNode && selectedCinemaDetail ? (
            <CinemaInspector
              key={JSON.stringify([visualOwnerEpoch, selectedCinemaDetail.nodeId])}
              detail={selectedCinemaDetail}
              project={activeCinemaProject}
              proposed={previewNodeIds.has(selectedNode.id)}
              planning={mockProposalStage === 'planning'}
              accepted={mockPlanAccepted}
              onPlan={mockPlanAccepted ? createPlanRevision : planMockScene}
              onCurateSource={curateProposalSource}
              shot={selectedAcceptedShot}
              onUpdateShot={updateAcceptedShot}
              revisions={revisionHistory}
              activeRevisionId={cinema?.activeRevisionId ?? null}
              onRestoreRevision={restorePlanRevision}
              onNotice={announce}
              cinemaDomain={activeCinemaData!}
              cinemaSceneId={selectedAcceptedShot?.sceneId
                ?? Object.values(activeCinemaData!.scenes).find((scene) => scene.nodeId === selectedNode.id)?.id
                ?? activeCinemaData!.activeSceneId!}
              onUpdateVisual={updateVisualPreproduction}
              capabilities={workspaceCapabilities.value}
              canvasImages={presentedNodes.flatMap((node) => node.data.kind === 'raster' ? [{
                nodeId: node.id,
                name: node.data.name,
                fileName: node.data.fileName,
                src: node.data.src,
                width: node.data.naturalWidth,
                height: node.data.naturalHeight,
              }] : [])}
              onCleanupMedia={cleanupUnusedMedia}
            />
          ) : selectedNode ? (
            <NodeInspector
              node={selectedNode}
              conversionOptions={conversionOptions}
              onConversionOptionsChange={setConversionOptions}
              onUpdate={updateNode}
              onVectorize={() => void vectorizeImage(selectedNode.id)}
              onCancelVectorize={cancelVectorization}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onMove={(direction) => moveLayer(selectedNode.id, direction)}
              onEditStart={beginFieldEdit}
              onEditEnd={endFieldEdit}
              onEditConcept={() => beginConceptEdit(selectedNode.id)}
              onConvert={(role) => convertConceptRole(selectedNode.id, role)}
              converting={convertingId === selectedNode.id}
            />
          ) : (
            <div className="empty-inspector">
              <MousePointer2 size={20} />
              <strong>Select a layer</strong>
              <span>Choose an object on the canvas or in the layer list to edit it.</span>
            </div>
          )}
        </aside>

        {mobilePanel ? <button type="button" className="panel-scrim" aria-label="Close side panel" onClick={() => setMobilePanel(null)} /> : null}

        {firstRunOpen ? (
          <FirstRunChooser
            providerMode={configuredProviderMode}
            onStartScene={chooseStartScene}
            onStartIdea={chooseStartIdea}
            onExploreSample={chooseSampleProject}
          />
        ) : null}

        <CinemaCreationPalette
          open={creationPaletteOpen}
          hasStory={nodes.some((node) => node.data.kind === 'concept'
            && cinemaDraftRole(node.data.domainType, node.data.eyebrow) === 'story')}
          hasScene={nodes.some((node) => node.data.kind === 'concept'
            && cinemaDraftRole(node.data.domainType, node.data.eyebrow) === 'scene')}
          contextLabel={selectedNode?.data.kind === 'concept' ? selectedNode.data.label : null}
          onClose={() => setCreationPaletteOpen(false)}
          onCreate={createFromPalette}
          onImportReference={() => {
            setCreationPaletteOpen(false);
            fileInputRef.current?.click();
          }}
        />




        {confirmationDialog}

        <div className="toast-region" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              {toast.tone === 'success' ? <Check size={15} /> : toast.tone === 'error' ? <X size={15} /> : <Sparkles size={15} />}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>

        <dialog
          ref={traceDialogRef}
          className="export-dialog trace-dialog"
          aria-labelledby="trace-title"
          onClose={() => setTraceOpen(false)}
        >
          {traceOpen && <form method="dialog">
            <div className="dialog-icon"><Sparkles size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Developer diagnostics</span>
              <h2 id="trace-title">Provider status and local traces</h2>
              <p>Operational metadata stays on this device and excludes scene text, prompts, citations, and provider credentials.</p>
            </div>
            <dl className="export-summary">
              <div><dt>Mode</dt><dd>{configuredProviderMode === 'loading' ? 'Unavailable' : configuredProviderMode}</dd></div>
              {workspaceCapabilities.value && (Object.keys(capabilityLabels) as Array<keyof typeof capabilityLabels>).map((key) => {
                const stage = workspaceCapabilities.value!.stages[key];
                return <div key={key}><dt>{capabilityLabels[key]}</dt><dd>{stage.provider}{stage.model ? ` · ${stage.model}` : ''} · {capabilityStatusLabels[stage.status]}<p>{capabilityDescription(stage)}</p></dd></div>;
              })}
              <div><dt>Advanced single-scene preflight</dt><dd>{configuredProviderStatus ? (configuredProviderStatus.livePreflight.ready ? `Request review required · ceiling ${configuredProviderStatus.livePreflight.maxLiveRunCost ?? 'not applicable in fixture mode'}` : configuredProviderStatus.livePreflight.blockers.join(' ')) : 'Unavailable'}</dd></div>
              <div><dt>Telemetry</dt><dd>{configuredProviderStatus?.telemetryPolicy ?? 'no-content-v1'}</dd></div>
            </dl>
            {workspaceCapabilities.error && <p role="alert">{workspaceCapabilities.error}</p>}
            <button type="button" onClick={() => void workspaceCapabilities.refresh()}>Refresh workspace status</button>
            <section className="trace-section" aria-labelledby="local-traces-title">
              <div className="trace-heading">
                <div><span className="eyebrow">On this device</span><h3 id="local-traces-title">Recent agent runs</h3></div>
                <span>{localCinemaTraces.length}/500</span>
              </div>
              {localCinemaTraces.length ? (
                <ul className="trace-list">
                  {localCinemaTraces.map((trace) => (
                    <li key={trace.id}>
                      <div>
                        <strong>{trace.id}</strong>
                        <span>{new Date(trace.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="trace-events" aria-label={`${trace.events.length} trace events`}>
                        {trace.events.map((event, index) => (
                          <span key={`${event.event}-${event.phase ?? 'run'}-${index}`} className={event.status === 'error' ? 'trace-error' : ''}>
                            {event.phase ?? event.event}{event.durationMs === undefined ? '' : ` · ${event.durationMs} ms`}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="trace-empty">No local run traces yet. Generate a shot plan to record one.</p>}
            </section>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setTraceOpen(false)}>Close</button>
              <button type="button" className="primary-button" disabled={!localCinemaTraces.length} onClick={exportLocalTraces}><Download size={14} /> Export trace JSON</button>
            </div>
          </form>}
        </dialog>

        <dialog
          ref={exportDialogRef}
          className="export-dialog"
          aria-labelledby="export-title"
          onClose={() => setExportOpen(false)}
        >
          <form method="dialog">
            <div className="dialog-icon"><Download size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Export</span>
              <h2 id="export-title">Editable SVG</h2>
              <p>Export visible images, vector paths, concepts, and connectors as one scalable document.</p>
            </div>
            <dl className="export-summary">
              <div><dt>Visible objects</dt><dd>{nodes.filter((node) => !node.hidden).length}</dd></div>
              <div><dt>Vector paths</dt><dd>{nodes.reduce((count, node) => count + (node.data.kind === 'vector' ? node.data.paths.filter((path) => path.visible).length : 0), 0)}</dd></div>
              <div><dt>Processing</dt><dd>On device</dd></div>
            </dl>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setExportOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={performExport}><Download size={14} /> Download SVG</button>
            </div>
          </form>
        </dialog>

        <dialog
          ref={backupDialogRef}
          className="export-dialog backup-dialog"
          aria-labelledby="backup-title"
          onClose={() => setBackupOpen(false)}
        >
          <form method="dialog">
            <div className="dialog-icon"><HardDrive size={19} /></div>
            <div className="dialog-copy">
              <span className="eyebrow">Local project</span>
              <h2 id="backup-title">Backup and restore</h2>
              <p>Your canvas is stored only in this browser. Download a portable backup before clearing browser data or changing devices.</p>
            </div>
            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={performBackup}>
                <Download size={14} /> Download backup
              </button>
              <button type="button" className="secondary-button" onClick={() => projectInputRef.current?.click()}>
                <Upload size={14} /> Restore backup
              </button>
            </div>
            <p className="backup-warning">Restoring a valid backup replaces the current canvas after confirmation.</p>
            <section className="checkpoint-section" aria-labelledby="checkpoint-title">
              <div className="checkpoint-heading">
                <div><span className="eyebrow">On this device</span><h3 id="checkpoint-title">Version checkpoints</h3></div>
                <button type="button" className="secondary-button" onClick={() => void createCheckpoint()}><Plus size={13} /> Save checkpoint</button>
              </div>
              {checkpoints.length ? (
                <ul className="checkpoint-list">
                  {checkpoints.map((checkpoint) => (
                    <li key={checkpoint.id}>
                      <button type="button" className="checkpoint-main" onClick={() => void restoreCheckpoint(checkpoint)}>
                        <strong>{checkpoint.title}</strong>
                        <span>{new Date(checkpoint.createdAt).toLocaleString()}</span>
                      </button>
                      <button type="button" className="checkpoint-delete" aria-label={`Delete checkpoint ${checkpoint.title}`} onClick={() => void removeCheckpoint(checkpoint.id)}><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : <p className="checkpoint-empty">No checkpoints yet. Save one before a major edit.</p>}
            </section>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setBackupOpen(false)}>Close</button>
            </div>
            <input
              ref={projectInputRef}
              className="visually-hidden"
              type="file"
              aria-label={`Choose a ${APP_CONFIG.name} project backup`}
              accept={`${APP_CONFIG.storage.projectExtension},application/json`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreProject(file);
                event.target.value = '';
              }}
            />
          </form>
        </dialog>
        </main>
          </NodeActionContext.Provider>
        </ProposedNodeIdsContext.Provider>
      </CinemaProjectContext.Provider>
    </SelectedNodeCountContext.Provider>
    </ExpandedStoryContext.Provider>
    </StoryAssistantContext.Provider></CinemaMediaContext.Provider>
  );
}

type NodeInspectorProps = {
  node: EditorNode;
  conversionOptions: ConversionOptions;
  onConversionOptionsChange: (options: ConversionOptions) => void;
  onUpdate: (id: string, updater: (node: EditorNode) => EditorNode, shouldRecord?: boolean) => void;
  onVectorize: () => void;
  onCancelVectorize: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onEditConcept: () => void;
  onConvert: (role: CinemaDraftRole) => void;
  converting: boolean;
};

function EdgeInspector({
  edge,
  onUpdate,
  onEditStart,
  onEditEnd,
  onDelete,
}: {
  edge: EditorEdge;
  onUpdate: (updater: (edge: EditorEdge) => EditorEdge, shouldRecord?: boolean) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onDelete: () => void;
}) {
  const data = edge.data ?? { label: '', kind: 'default' as const };
  return (
    <>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Connector label</span>
          <input
            value={data.label}
            maxLength={240}
            placeholder="Describe the relationship"
            onFocus={onEditStart}
            onChange={(event) => onUpdate((current) => ({
              ...current,
              label: event.target.value,
              data: { ...(current.data ?? { kind: 'default' }), label: event.target.value },
            }), false)}
            onBlur={onEditEnd}
          />
        </label>
        <label className="stacked-field">
          <span>Connector style</span>
          <select
            value={data.kind}
            onFocus={onEditStart}
            onChange={(event) => {
              const kind = event.target.value as 'default' | 'dashed' | 'emphasis';
              onUpdate((current) => ({
                ...current,
                data: { ...(current.data ?? { label: '' }), kind },
              }), false);
            }}
            onBlur={onEditEnd}
          >
            <option value="default">Default</option>
            <option value="dashed">Dashed</option>
            <option value="emphasis">Emphasis</option>
          </select>
        </label>
      </div>
      <div className="inspector-actions single-action">
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Delete connector</button>
      </div>
    </>
  );
}

function MultiSelectionInspector({
  count,
  onTone,
  onOpacity,
  onAlign,
  onDuplicate,
  onLock,
  onUnlock,
  onDelete,
}: {
  count: number;
  onTone: (tone: 'ink' | 'indigo' | 'mint') => void;
  onOpacity: (opacity: number) => void;
  onAlign: (mode: 'left' | 'top' | 'horizontal' | 'vertical') => void;
  onDuplicate: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="multi-selection-summary">
        <Layers3 size={19} />
        <div><strong>{count} layers selected</strong><span>Changes apply to unlocked layers.</span></div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Concept style</span>
        <div className="segmented-actions">
          <button type="button" onClick={() => onTone('ink')}>Ink</button>
          <button type="button" onClick={() => onTone('indigo')}>Indigo</button>
          <button type="button" onClick={() => onTone('mint')}>Mint</button>
        </div>
        <span className="section-label section-label-spaced">Opacity</span>
        <div className="segmented-actions">
          <button type="button" onClick={() => onOpacity(1)}>100%</button>
          <button type="button" onClick={() => onOpacity(.75)}>75%</button>
          <button type="button" onClick={() => onOpacity(.5)}>50%</button>
        </div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Arrange</span>
        <div className="arrange-actions">
          <button type="button" onClick={() => onAlign('left')}>Align left</button>
          <button type="button" onClick={() => onAlign('top')}>Align top</button>
          <button type="button" onClick={() => onAlign('horizontal')} disabled={count < 3}>Distribute ↔</button>
          <button type="button" onClick={() => onAlign('vertical')} disabled={count < 3}>Distribute ↕</button>
        </div>
      </div>
      <div className="multi-selection-actions">
        <button type="button" onClick={onDuplicate}><Copy size={13} /> Duplicate</button>
        <button type="button" onClick={onLock}><Lock size={13} /> Lock</button>
        <button type="button" onClick={onUnlock}><Unlock size={13} /> Unlock</button>
      </div>
      <div className="inspector-actions single-action multi-selection-delete">
        <button type="button" className="danger" onClick={onDelete}><Trash2 size={14} /> Delete unlocked layers</button>
      </div>
    </>
  );
}

function NodeInspector({
  node,
  conversionOptions,
  onConversionOptionsChange,
  onUpdate,
  onVectorize,
  onCancelVectorize,
  onDuplicate,
  onDelete,
  onMove,
  onEditStart,
  onEditEnd,
  onEditConcept,
  onConvert,
  converting,
}: NodeInspectorProps) {
  const updateData = (data: Partial<EditorNode['data']>, shouldRecord = true) =>
    onUpdate(
      node.id,
      (current) => ({
        ...current,
        data: { ...current.data, ...data } as EditorNode['data'],
      }),
      shouldRecord,
    );

  return (
    <>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Name</span>
          <input
            value={node.data.name}
            maxLength={240}
            disabled={node.data.locked}
            onFocus={onEditStart}
            onChange={(event) => updateData({ name: event.target.value }, false)}
            onBlur={onEditEnd}
          />
        </label>
        {node.data.kind === 'concept' ? (
          <label className="stacked-field">
            <span>Label</span>
            <input
              value={node.data.label}
              maxLength={500}
              disabled={node.data.locked}
              onFocus={onEditStart}
              onChange={(event) => updateData({
                label: event.target.value,
                name: event.target.value,
                title: replaceRichTextPlainText(
                  node.data.kind === 'concept' ? node.data.title : emptyRichText(),
                  event.target.value,
                ),
              }, false)}
              onBlur={onEditEnd}
            />
          </label>
        ) : null}
        {node.data.kind === 'concept' ? (
          <>
            <label className="stacked-field">
              <span>Cinema role</span>
              <select
                value={cinemaDraftRole(node.data.domainType, node.data.eyebrow) ?? ''}
                disabled={node.data.locked}
                onChange={(event) => {
                  if (event.target.value) onConvert(event.target.value as CinemaDraftRole);
                }}
              >
                <option value="">Generic note</option>
                {CINEMA_DRAFT_DESCRIPTORS.map((descriptor) => (
                  <option key={descriptor.role} value={descriptor.role}>{descriptor.label}</option>
                ))}
              </select>
              <small>Conversion changes meaning and contextual add actions, not your written content.</small>
            </label>
            <label className="stacked-field">
              <span>Eyebrow</span>
              <input
                value={node.data.eyebrow}
                maxLength={160}
                disabled={node.data.locked}
                onFocus={onEditStart}
                onChange={(event) => updateData({ eyebrow: event.target.value }, false)}
                onBlur={onEditEnd}
              />
            </label>
            <label className="stacked-field">
              <span>Style</span>
              <select
                value={node.data.tone}
                disabled={node.data.locked}
                onFocus={onEditStart}
                onChange={(event) => updateData({ tone: event.target.value as 'ink' | 'indigo' | 'mint' }, false)}
                onBlur={onEditEnd}
              >
                <option value="ink">Ink</option>
                <option value="indigo">Indigo</option>
                <option value="mint">Mint</option>
              </select>
            </label>
            <fieldset className="content-alignment-field" disabled={node.data.locked}>
              <legend>Content alignment</legend>
              <div className="content-alignment-row">
                <span>Across</span>
                {(['left', 'center', 'right'] as const).map((alignment) => (
                  <button
                    key={alignment}
                    type="button"
                    aria-label={`Align content ${alignment}`}
                    aria-pressed={node.data.horizontalAlign === alignment}
                    onClick={() => updateData({ horizontalAlign: alignment })}
                  >
                    {alignment[0].toUpperCase() + alignment.slice(1)}
                  </button>
                ))}
              </div>
              <div className="content-alignment-row">
                <span>Down</span>
                {(['top', 'middle', 'bottom'] as const).map((alignment) => (
                  <button
                    key={alignment}
                    type="button"
                    aria-label={`Align content ${alignment}`}
                    aria-pressed={node.data.verticalAlign === alignment}
                    onClick={() => updateData({ verticalAlign: alignment })}
                  >
                    {alignment[0].toUpperCase() + alignment.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" className="secondary-button edit-content-button" disabled={node.data.locked} onClick={onEditConcept}>
              <TypeIcon size={13} /> Edit rich text
            </button>
          </>
        ) : null}
      </div>
      <div className="inspector-section">
        <span className="section-label">Position</span>
        <div className="field-grid">
          <label>X <input type="number" value={Math.round(node.position.x)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, x: Number(event.target.value) } }), false)} onBlur={onEditEnd} /></label>
          <label>Y <input type="number" value={Math.round(node.position.y)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => onUpdate(node.id, (current) => ({ ...current, position: { ...current.position, y: Number(event.target.value) } }), false)} onBlur={onEditEnd} /></label>
        </div>
      </div>
      <div className="inspector-section">
        <span className="section-label">Appearance</span>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(node.data.opacity * 100)} disabled={node.data.locked} onFocus={onEditStart} onChange={(event) => updateData({ opacity: Number(event.target.value) / 100 }, false)} onBlur={onEditEnd} />
          <output>{Math.round(node.data.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={node.data.locked} onChange={() => onUpdate(node.id, (current) => ({ ...current, draggable: current.data.locked, deletable: current.data.locked, data: { ...current.data, locked: !current.data.locked } }))} />
          <span>Lock layer</span>
        </label>
      </div>
      {EDITOR_FEATURES.imageVectorization && node.data.kind === 'raster' ? (
        <div className="inspector-section">
          <span className="section-label">Local vectorization</span>
          <label className="stacked-field">
            <span>Detail</span>
            <select value={conversionOptions.preset} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, preset: event.target.value as ConversionOptions['preset'] })}>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
              <option value="poster">Poster</option>
            </select>
          </label>
          <label className="full-field">
            <span>Colors</span>
            <input type="range" min="2" max="32" value={conversionOptions.colors} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, colors: Number(event.target.value) })} />
            <output>{conversionOptions.colors}</output>
          </label>
          <label className="full-field">
            <span>Smoothing</span>
            <input type="range" min="0" max="5" value={conversionOptions.despeckle} onChange={(event) => onConversionOptionsChange({ ...conversionOptions, despeckle: Number(event.target.value) })} />
            <output>{conversionOptions.despeckle}</output>
          </label>
          <div className="conversion-actions">
            <button type="button" className={converting ? 'secondary-button' : 'primary-button'} onClick={converting ? onCancelVectorize : onVectorize}>{converting ? <X size={14} /> : <Shapes size={14} />} {converting ? 'Cancel tracing' : 'Vectorize'}</button>
          </div>
          <p className="privacy-hint"><Check size={12} /> Vectorization runs on this device.</p>
        </div>
      ) : null}
      {node.data.kind === 'vector' ? (
        <div className="inspector-section">
          <span className="section-label">Vector summary</span>
          <div className="conversion-card"><Layers3 size={16} /><div><strong>{node.data.paths.length} editable paths</strong><span>Expand this layer to edit individual colors and visibility.</span></div></div>
        </div>
      ) : null}
      <div className="inspector-actions">
        <button type="button" aria-label="Move layer up" onClick={() => onMove(1)}><ArrowUp size={14} /></button>
        <button type="button" aria-label="Move layer down" onClick={() => onMove(-1)}><ArrowDown size={14} /></button>
        <button type="button" aria-label="Duplicate layer" onClick={onDuplicate}><Copy size={14} /></button>
        <button type="button" className="danger" aria-label="Delete layer" onClick={onDelete} disabled={node.data.locked}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

function PathInspector({
  path,
  onUpdate,
  onClose,
  onEditStart,
  onEditEnd,
  onMove,
  onDuplicate,
  onDelete,
}: {
  path: VectorPathLayer;
  onUpdate: (updater: (path: VectorPathLayer) => VectorPathLayer, shouldRecord?: boolean) => void;
  onClose: () => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="path-inspector-heading">
        <div><span className="eyebrow">Vector path</span><strong>{path.name}</strong></div>
        <button type="button" className="icon-button" aria-label="Close path properties" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="inspector-section">
        <label className="stacked-field">
          <span>Name</span>
          <input value={path.name} maxLength={240} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, name: event.target.value }), false)} onBlur={onEditEnd} />
        </label>
        <label className="color-field">
          <span>Fill</span>
          <input type="color" value={path.fill === 'none' ? '#000000' : path.fill} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, fill: event.target.value }), false)} onBlur={onEditEnd} />
          <code>{path.fill}</code>
        </label>
        <label className="full-field">
          <span>Opacity</span>
          <input type="range" min="0" max="100" value={Math.round(path.opacity * 100)} disabled={path.locked} onFocus={onEditStart} onChange={(event) => onUpdate((current) => ({ ...current, opacity: Number(event.target.value) / 100 }), false)} onBlur={onEditEnd} />
          <output>{Math.round(path.opacity * 100)}%</output>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={path.visible} onChange={() => onUpdate((current) => ({ ...current, visible: !current.visible }))} />
          <span>Visible on canvas</span>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={path.locked} onChange={() => onUpdate((current) => ({ ...current, locked: !current.locked }))} />
          <span>Lock path</span>
        </label>
      </div>
      <div className="inspector-actions">
        <button type="button" aria-label="Move path up" onClick={() => onMove(-1)} disabled={path.locked}><ArrowUp size={14} /></button>
        <button type="button" aria-label="Move path down" onClick={() => onMove(1)} disabled={path.locked}><ArrowDown size={14} /></button>
        <button type="button" aria-label="Duplicate path" onClick={onDuplicate} disabled={path.locked}><Copy size={14} /></button>
        <button type="button" className="danger" aria-label="Delete path" onClick={onDelete} disabled={path.locked}><Trash2 size={14} /></button>
      </div>
    </>
  );
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
