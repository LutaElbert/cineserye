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
  CinemaProjectPresentation,
  PromptArtifact,
} from '../../domain/cinema/prompt-artifacts';
import type { ResearchSourceCuration } from '../../domain/cinema/project-data';
import { planningLabel } from './planning-labels';

type InspectorTab = 'details' | 'prompt' | 'sources' | 'cost';

const TAB_LABELS: ReadonlyArray<{ id: InspectorTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'sources', label: 'Sources' },
  { id: 'cost', label: 'Cost' },
];

function money(value: number, currency: 'PHP' | 'USD') {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function costLabel(
  value: number | null,
  pricingMode: CinemaProjectPresentation['cost']['pricingMode'],
  currency: CinemaProjectPresentation['cost']['currency'],
) {
  if (value === null || pricingMode === 'unpriced') return 'Unpriced';
  if (pricingMode === 'credits') return `${value.toLocaleString('en-US')} credits`;
  return money(value, currency ?? 'USD');
}

function PromptCard({
  prompt,
  project,
  onNotice,
}: {
  prompt: PromptArtifact;
  project: CinemaProjectPresentation;
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
  onCurateSource,
  onNotice,
}: {
  detail: CinemaNodePresentation;
  project: CinemaProjectPresentation;
  proposed: boolean;
  planning: boolean;
  accepted: boolean;
  onPlan: () => void;
  onCurateSource: (sourceId: string, action: ResearchSourceCuration) => void;
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
  const fixtureOnly = Object.values(project.sources).every((source) => source.isMock);

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
        <span>{fixtureOnly
          ? 'Fixture research and generation prices are illustrative.'
          : 'Research sources are linked; generation prices remain illustrative.'}</span>
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
                  {planning
                    ? planningLabel('planning')
                    : accepted
                      ? planningLabel('accepted')
                      : proposed
                        ? planningLabel('ready')
                        : planningLabel('idle')}
                </button>
                <p>{accepted ? 'The prompt package is on the canvas and remains one undoable change.' : 'Uses the configured server-side providers; the canvas changes only after explicit acceptance.'}</p>
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
                    <span>{source.status.replace('-', ' ')}</span>
                    <span>{source.isMock ? 'Fixture source' : 'Research source'}</span>
                  </header>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong></a>
                  ) : <strong>{source.title}</strong>}
                  <small>{source.publisher}</small>
                  <p>{source.finding}</p>
                  <dl className="source-metadata">
                    <div><dt>Purpose</dt><dd>{source.queryPurpose}</dd></div>
                    <div><dt>Retrieved</dt><dd>{new Date(source.retrievedAt).toLocaleString()}</dd></div>
                    <div><dt>Used by</dt><dd>{source.usageCount} {source.usageCount === 1 ? 'prompt' : 'prompts'}</dd></div>
                  </dl>
                  {proposed ? (
                    <div className="source-curation-actions" aria-label={`Curate ${source.title}`}>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-pressed={source.status === 'supported'}
                        onClick={() => onCurateSource(source.id, { type: 'set-status', status: 'supported' })}
                      >Supported</button>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-pressed={source.status === 'needs-verification'}
                        onClick={() => onCurateSource(source.id, { type: 'set-status', status: 'needs-verification' })}
                      >Verify</button>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-pressed={source.status === 'irrelevant'}
                        onClick={() => onCurateSource(source.id, { type: 'set-status', status: 'irrelevant' })}
                      >Irrelevant</button>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-pressed={source.creatorPinned}
                        disabled={source.status === 'irrelevant'}
                        onClick={() => onCurateSource(source.id, { type: 'set-pinned', pinned: !source.creatorPinned })}
                      >{source.creatorPinned ? 'Unpin' : 'Pin'}</button>
                      <button
                        type="button"
                        className="secondary-button danger-button"
                        onClick={() => onCurateSource(source.id, { type: 'remove' })}
                      >Remove</button>
                    </div>
                  ) : source.creatorPinned ? <span className="source-pinned-label">Creator pinned</span> : null}
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
                <div><strong>{costLabel(cost.expected, cost.pricingMode, cost.currency)}</strong><span>Expected AI-generation cost</span></div>
              </div>
              <p className="budget-caption">Physical-production constraints are tracked separately and are never compared with this estimate.</p>
              {cost.pricingMode !== 'unpriced' ? (
                <div className="cost-range" aria-label="Illustrative AI-generation cost range">
                  <div><span>Minimum</span><strong>{costLabel(cost.minimum, cost.pricingMode, cost.currency)}</strong></div>
                  <div><span>Expected</span><strong>{costLabel(cost.expected, cost.pricingMode, cost.currency)}</strong></div>
                  <div><span>High risk</span><strong>{costLabel(cost.highRisk, cost.pricingMode, cost.currency)}</strong></div>
                </div>
              ) : <p className="budget-caption">Provider pricing is unavailable. Cineserye shows bounded attempt guidance without inventing a quote.</p>}
              {projectCost?.ceiling !== null && projectCost?.ceiling !== undefined && projectCost.expected !== null ? (
                <>
                  <div className="budget-meter">
                    <div style={{ inlineSize: `${projectCost.ceiling > 0 ? Math.min(100, (projectCost.expected / projectCost.ceiling) * 100) : 100}%` }} />
                  </div>
                  <p className="budget-caption">{projectCost.expected <= projectCost.ceiling
                    ? `${costLabel(projectCost.ceiling - projectCost.expected, projectCost.pricingMode, projectCost.currency)} expected headroom below the ${costLabel(projectCost.ceiling, projectCost.pricingMode, projectCost.currency)} AI-generation ceiling.`
                    : `${costLabel(projectCost.expected - projectCost.ceiling, projectCost.pricingMode, projectCost.currency)} above the ${costLabel(projectCost.ceiling, projectCost.pricingMode, projectCost.currency)} AI-generation ceiling; revise before accepting.`}</p>
                  <ul className="cost-assumptions">
                    {projectCost.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
                  </ul>
                </>
              ) : projectCost ? (
                <>
                  <p className="budget-caption">No exact AI-generation ceiling was set. Physical-production constraints are tracked separately in the scene brief.</p>
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
