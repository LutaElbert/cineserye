'use client';

import {
  Bot,
  Check,
  CircleDollarSign,
  Clipboard,
  FileText,
  Link2,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  CinemaNodePresentation,
  MockCinemaProject,
  PromptArtifact,
} from '../../domain/cinema/prompt-artifacts';

type InspectorTab = 'details' | 'prompt' | 'sources' | 'cost';

const TAB_LABELS: ReadonlyArray<{ id: InspectorTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'sources', label: 'Sources' },
  { id: 'cost', label: 'Cost' },
];

function money(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function PromptCard({
  prompt,
  project,
  onNotice,
}: {
  prompt: PromptArtifact;
  project: MockCinemaProject;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.generatedText);
      onNotice(`${prompt.label} copied.`, 'success');
    } catch {
      onNotice('The prompt could not be copied from this browser.', 'error');
    }
  };

  return (
    <article className="prompt-card">
      <header>
        <div>
          <span>{prompt.purpose.replace('-', ' ')}</span>
          <strong>{prompt.label}</strong>
        </div>
        <span className="provider-badge">{prompt.providerProfile === 'vertex-veo' ? 'Vertex · Veo' : 'Generic'}</span>
      </header>
      {prompt.continuitySourceIds.length ? (
        <div className="prompt-inheritance">
          <Link2 size={12} aria-hidden="true" />
          <span>
            Inherits {prompt.continuitySourceIds.map((id) => project.nodes[id]?.title ?? id).join(', ')}
          </span>
        </div>
      ) : null}
      <p className="prompt-text">{prompt.generatedText}</p>
      {prompt.negativeConstraints.length ? (
        <div className="prompt-constraints">
          <span>Negative constraints</span>
          <p>{prompt.negativeConstraints.join(' · ')}</p>
        </div>
      ) : null}
      <footer>
        <span>Version {prompt.version} · {prompt.status}</span>
        <button type="button" className="secondary-button" onClick={() => void copy()}>
          <Clipboard size={12} /> Copy prompt
        </button>
      </footer>
    </article>
  );
}

export function CinemaInspector({
  detail,
  project,
  proposed,
  planning,
  accepted,
  onPlan,
  onNotice,
}: {
  detail: CinemaNodePresentation;
  project: MockCinemaProject;
  proposed: boolean;
  planning: boolean;
  accepted: boolean;
  onPlan: () => void;
  onNotice: (message: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [tab, setTab] = useState<InspectorTab>(detail.kind === 'shot' ? 'prompt' : 'details');

  const nodePrompts = useMemo(
    () => detail.promptIds.map((id) => project.prompts[id]).filter(Boolean),
    [detail.promptIds, project.prompts],
  );
  const sources = useMemo(
    () => detail.sourceIds.map((id) => project.sources[id]).filter(Boolean),
    [detail.sourceIds, project.sources],
  );
  const projectCost = detail.kind === 'scene' || detail.kind === 'agent-run' ? project.cost : null;
  const cost = detail.cost ?? projectCost;
  const riskLabel = detail.risk === 'none' ? 'No direct risk' : `${detail.risk} risk`;

  return (
    <div className="cinema-inspector">
      <section className="cinema-selection-summary">
        <div className={`cinema-kind-icon kind-${detail.kind}`} aria-hidden="true">
          {detail.kind === 'agent-run' ? <Bot size={15} /> : <FileText size={15} />}
        </div>
        <div>
          <span>{detail.kind.replace('-', ' ')}</span>
          <strong>{detail.title}</strong>
          <small>{proposed ? 'Proposed · not saved' : detail.statusLabel}</small>
        </div>
      </section>

      <div className="demo-data-note" role="note">
        <Sparkles size={12} aria-hidden="true" />
        <span>Demo data — research and prices are illustrative.</span>
      </div>

      <div className="inspector-tabs" role="tablist" aria-label={`${detail.title} properties`}>
        {TAB_LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`cinema-${item.id}-panel`}
            id={`cinema-${item.id}-tab`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === 'prompt' && nodePrompts.length ? <span>{nodePrompts.length}</span> : null}
          </button>
        ))}
      </div>

      <div
        id={`cinema-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`cinema-${tab}-tab`}
        className="cinema-tab-panel"
      >
        {tab === 'details' ? (
          <>
            <section className="cinema-detail-hero">
              <p>{detail.summary}</p>
              <div>
                <span>{detail.metricLabel}</span>
                <span className={`risk-pill risk-${detail.risk}`}>{riskLabel}</span>
              </div>
            </section>
            <dl className="cinema-field-list">
              {detail.fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
            {detail.tags.length ? (
              <div className="cinema-tags" aria-label="Tags">
                {detail.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            ) : null}
            {detail.kind === 'scene' ? (
              <div className="scene-plan-action">
                <button
                  type="button"
                  className="primary-button"
                  disabled={planning || proposed || accepted}
                  onClick={onPlan}
                >
                  {planning ? <LoaderCircle className="spin" size={14} /> : accepted ? <Check size={14} /> : <Sparkles size={14} />}
                  {planning ? 'Planning mock scene…' : accepted ? 'Plan accepted' : proposed ? 'Review proposal' : 'Draft shot prompts'}
                </button>
                <p>{accepted ? 'The prompt package is on the canvas and remains one undoable change.' : 'Uses fixed local mock data. No provider or network request will run.'}</p>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'prompt' ? (
          nodePrompts.length ? (
            <div className="prompt-card-list">
              {nodePrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} project={project} onNotice={onNotice} />
              ))}
            </div>
          ) : (
            <div className="cinema-empty-state">
              <FileText size={18} />
              <strong>No direct prompt</strong>
              <span>This node organizes the proposal rather than generating media.</span>
            </div>
          )
        ) : null}

        {tab === 'sources' ? (
          sources.length ? (
            <div className="source-card-list">
              {sources.map((source) => (
                <article key={source.id} className="source-card">
                  <header>
                    <span>{source.status}</span>
                    <span>Mock source</span>
                  </header>
                  <strong>{source.title}</strong>
                  <small>{source.publisher}</small>
                  <p>{source.finding}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="cinema-empty-state"><Link2 size={18} /><strong>No linked sources</strong><span>This item is derived from the creator’s premise.</span></div>
          )
        ) : null}

        {tab === 'cost' ? (
          cost ? (
            <div className="cost-panel">
              <div className="cost-heading">
                <CircleDollarSign size={18} />
                <div><strong>{money(cost.expected)}</strong><span>Expected generation cost</span></div>
              </div>
              <div className="cost-range" aria-label="Illustrative generation cost range">
                <div><span>Minimum</span><strong>{money(cost.minimum)}</strong></div>
                <div><span>Expected</span><strong>{money(cost.expected)}</strong></div>
                <div><span>High risk</span><strong>{money(cost.highRisk)}</strong></div>
              </div>
              {projectCost ? (
                <>
                  <div className="budget-meter">
                    <div style={{ inlineSize: `${Math.min(100, (projectCost.expected / projectCost.ceiling) * 100)}%` }} />
                  </div>
                  <p className="budget-caption">{money(projectCost.ceiling - projectCost.expected)} expected headroom below the {money(projectCost.ceiling)} ceiling.</p>
                  <ul className="cost-assumptions">
                    {projectCost.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                  </ul>
                </>
              ) : (
                <p className="budget-caption">Shot-level estimate based on duration, difficulty, and expected retries.</p>
              )}
            </div>
          ) : (
            <div className="cinema-empty-state"><CircleDollarSign size={18} /><strong>No direct generation cost</strong><span>This reusable element contributes through the shots that reference it.</span></div>
          )
        ) : null}
      </div>
    </div>
  );
}
