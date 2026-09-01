'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  SceneBriefValidationError,
  validateScenePlanningBrief,
  type ScenePlanningBrief,
} from '../../domain/cinema/scene-brief';

export type SceneBriefDefaults = ScenePlanningBrief;

type FieldErrors = Partial<Record<SceneBriefValidationError['field'] | 'liveProviderConsent', string>>;

function lines(value: string) {
  return value.split('\n');
}

export function SceneBriefDialog({
  defaults,
  providerMode,
  onCancel,
  onSubmit,
}: {
  defaults: SceneBriefDefaults;
  providerMode: 'fixture' | 'live';
  onCancel: () => void;
  onSubmit: (brief: ScenePlanningBrief, liveProviderConsent: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const genreToneRef = useRef<HTMLInputElement>(null);
  const [creationMode, setCreationMode] = useState(defaults.creationMode);
  const [aspectRatio, setAspectRatio] = useState(defaults.aspectRatio);
  const [targetPlatform, setTargetPlatform] = useState(defaults.targetPlatform);
  const [genreTone, setGenreTone] = useState(defaults.genreTone);
  const [locationPeriod, setLocationPeriod] = useState(defaults.locationPeriod);
  const [dialogueAudioIntent, setDialogueAudioIntent] = useState(defaults.dialogueAudioIntent);
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(String(defaults.targetDurationSeconds));
  const [requiredBeats, setRequiredBeats] = useState(defaults.requiredBeats.join('\n'));
  const [mustInclude, setMustInclude] = useState(defaults.mustInclude.join('\n'));
  const [mustAvoid, setMustAvoid] = useState(defaults.mustAvoid.join('\n'));
  const [generationPricingMode, setGenerationPricingMode] = useState(defaults.generationBudget.pricingMode);
  const [generationCurrency, setGenerationCurrency] = useState(defaults.generationBudget.currency ?? 'PHP');
  const [generationCeiling, setGenerationCeiling] = useState(
    defaults.generationBudget.ceiling === null ? '' : String(defaults.generationBudget.ceiling),
  );
  const [maxAttempts, setMaxAttempts] = useState(String(defaults.generationBudget.maxAttempts));
  const [productionBudgetBand, setProductionBudgetBand] = useState(defaults.productionConstraints.budgetBand);
  const [productionCurrency, setProductionCurrency] = useState(defaults.productionConstraints.currency);
  const [productionBudgetCeiling, setProductionBudgetCeiling] = useState(
    defaults.productionConstraints.budgetCeiling === null
      ? ''
      : String(defaults.productionConstraints.budgetCeiling),
  );
  const [availableEquipment, setAvailableEquipment] = useState(
    defaults.productionConstraints.availableEquipment.join('\n'),
  );
  const [liveProviderConsent, setLiveProviderConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    genreToneRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const productionBudgetHelp = useMemo(() => ({
    micro: 'One location, minimal cast, owned equipment, and practical coverage.',
    lean: 'A compact indie setup with limited crew, rentals, or art direction.',
    indie: 'More room for crew, locations, equipment, and production design.',
    custom: 'Use a custom physical-production band and optional ceiling.',
  })[productionBudgetBand], [productionBudgetBand]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (providerMode === 'live' && !liveProviderConsent) {
        setErrors({ liveProviderConsent: 'Confirm the live provider content transfer to continue.' });
        window.requestAnimationFrame(() => document.getElementById('scene-brief-liveProviderConsent')?.focus());
        return;
      }
      const brief = validateScenePlanningBrief({
        version: 2,
        sceneNodeId: defaults.sceneNodeId,
        sceneText: defaults.sceneText,
        creationMode,
        aspectRatio,
        targetPlatform,
        genreTone,
        locationPeriod,
        dialogueAudioIntent,
        targetDurationSeconds: Number(targetDurationSeconds),
        requiredBeats: lines(requiredBeats),
        mustInclude: lines(mustInclude),
        mustAvoid: lines(mustAvoid),
        generationBudget: {
          pricingMode: generationPricingMode,
          currency: generationPricingMode === 'currency' ? generationCurrency : null,
          ceiling: generationPricingMode === 'unpriced' || !generationCeiling.trim()
            ? null
            : Number(generationCeiling),
          maxAttempts: Number(maxAttempts),
        },
        productionConstraints: {
          budgetBand: productionBudgetBand,
          currency: productionCurrency,
          budgetCeiling: productionBudgetCeiling.trim() ? Number(productionBudgetCeiling) : null,
          availableEquipment: lines(availableEquipment),
        },
      });
      setErrors({});
      onSubmit(brief, liveProviderConsent);
    } catch (error) {
      if (error instanceof SceneBriefValidationError) {
        setErrors({ [error.field]: error.message });
        window.requestAnimationFrame(() => {
          document.getElementById(`scene-brief-${error.field}`)?.focus();
        });
        return;
      }
      setErrors({ sceneText: error instanceof Error ? error.message : 'The scene brief is invalid.' });
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="scene-brief-dialog"
      aria-labelledby="scene-brief-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form method="dialog" onSubmit={submit} noValidate>
        <header>
          <div className="scene-brief-heading-row">
            <div>
              <span className="eyebrow">One-scene preflight</span>
              <h2 id="scene-brief-title">Generate shot plan</h2>
            </div>
            <span className={`provider-mode-badge mode-${providerMode}`} aria-label={`${providerMode} provider mode`}>
              {providerMode === 'live' ? 'Live mode' : 'Fixture mode'}
            </span>
          </div>
          <p>Describe the creative intent, AI-generation allowance, and physical-production reality separately.</p>
        </header>

        <label className="scene-brief-field scene-brief-wide">
          <span>Selected scene text</span>
          <textarea id="scene-brief-sceneText" value={defaults.sceneText} readOnly rows={3} aria-invalid={Boolean(errors.sceneText)} />
          <small>Cineserye reads this directly from the selected scene node. Edit the node to change it.</small>
          {errors.sceneText ? <strong id="scene-brief-sceneText-error" role="alert">{errors.sceneText}</strong> : null}
        </label>

        <fieldset className="scene-brief-section scene-brief-wide">
          <legend>Creative intent</legend>
          <div className="scene-brief-grid">
            <label className="scene-brief-field">
              <span>Creation mode</span>
              <select id="scene-brief-creationMode" aria-label="Creation mode" value={creationMode} onChange={(event) => setCreationMode(event.target.value as ScenePlanningBrief['creationMode'])}>
                <option value="ai-generated">AI-generated</option>
                <option value="live-action">Live action</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label className="scene-brief-field">
              <span>Aspect ratio</span>
              <select id="scene-brief-aspectRatio" aria-label="Aspect ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ScenePlanningBrief['aspectRatio'])}>
                <option value="9:16">9:16 vertical</option>
                <option value="16:9">16:9 landscape</option>
                <option value="1:1">1:1 square</option>
                <option value="4:5">4:5 portrait</option>
              </select>
            </label>
            <label className="scene-brief-field">
              <span>Target platform</span>
              <select id="scene-brief-targetPlatform" aria-label="Target platform" value={targetPlatform} onChange={(event) => setTargetPlatform(event.target.value as ScenePlanningBrief['targetPlatform'])}>
                <option value="short-form">TikTok, Reels, or Shorts</option>
                <option value="youtube">YouTube</option>
                <option value="film-festival">Film festival</option>
                <option value="commercial">Commercial or branded</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="scene-brief-field">
              <span>Dialogue and audio</span>
              <select id="scene-brief-dialogueAudioIntent" aria-label="Dialogue and audio intent" value={dialogueAudioIntent} onChange={(event) => setDialogueAudioIntent(event.target.value as ScenePlanningBrief['dialogueAudioIntent'])}>
                <option value="dialogue-led">Dialogue-led</option>
                <option value="music-led">Music-led</option>
                <option value="sound-design-led">Sound-design-led</option>
                <option value="silent">Silent</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label className="scene-brief-field">
              <span>Genre and tone</span>
              <input id="scene-brief-genreTone" ref={genreToneRef} aria-label="Genre and tone" value={genreTone} onChange={(event) => setGenreTone(event.target.value)} aria-invalid={Boolean(errors.genreTone)} />
              {errors.genreTone ? <strong role="alert">{errors.genreTone}</strong> : null}
            </label>
            <label className="scene-brief-field">
              <span>Location and period</span>
              <input id="scene-brief-locationPeriod" aria-label="Location and period" value={locationPeriod} onChange={(event) => setLocationPeriod(event.target.value)} aria-invalid={Boolean(errors.locationPeriod)} />
              {errors.locationPeriod ? <strong role="alert">{errors.locationPeriod}</strong> : null}
            </label>
            <label className="scene-brief-field">
              <span>Target duration (seconds)</span>
              <input id="scene-brief-targetDurationSeconds" aria-label="Target duration (seconds)" type="number" min="6" max="180" step="1" value={targetDurationSeconds} onChange={(event) => setTargetDurationSeconds(event.target.value)} aria-invalid={Boolean(errors.targetDurationSeconds)} />
              {errors.targetDurationSeconds ? <strong role="alert">{errors.targetDurationSeconds}</strong> : null}
            </label>
          </div>
        </fieldset>

        <fieldset className="scene-brief-section scene-brief-wide">
          <legend>Story constraints</legend>
          <div className="scene-brief-grid">
            <label className="scene-brief-field">
              <span>Required beats (optional)</span>
              <textarea id="scene-brief-requiredBeats" aria-label="Required beats (optional)" rows={3} value={requiredBeats} onChange={(event) => setRequiredBeats(event.target.value)} />
              <small>One beat per line, in narrative order.</small>
            </label>
            <label className="scene-brief-field">
              <span>Must include (optional)</span>
              <textarea id="scene-brief-mustInclude" aria-label="Must include (optional)" rows={3} value={mustInclude} onChange={(event) => setMustInclude(event.target.value)} />
              <small>Characters, props, wardrobe, actions, or visual anchors.</small>
            </label>
            <label className="scene-brief-field">
              <span>Must avoid (optional)</span>
              <textarea id="scene-brief-mustAvoid" aria-label="Must avoid (optional)" rows={3} value={mustAvoid} onChange={(event) => setMustAvoid(event.target.value)} />
              <small>Content, techniques, costs, or continuity changes to exclude.</small>
            </label>
          </div>
        </fieldset>

        <fieldset id="scene-brief-generationBudget" className="scene-brief-section scene-brief-wide" tabIndex={-1}>
          <legend>AI-generation budget</legend>
          <div className="scene-brief-grid">
            <label className="scene-brief-field">
              <span>Pricing basis</span>
              <select aria-label="AI-generation pricing basis" value={generationPricingMode} onChange={(event) => setGenerationPricingMode(event.target.value as ScenePlanningBrief['generationBudget']['pricingMode'])}>
                <option value="currency">Currency estimate</option>
                <option value="credits">Provider credits</option>
                <option value="unpriced">Unpriced attempt guidance</option>
              </select>
            </label>
            {generationPricingMode === 'currency' ? (
              <label className="scene-brief-field">
                <span>Generation currency</span>
                <select aria-label="AI-generation currency" value={generationCurrency} onChange={(event) => setGenerationCurrency(event.target.value as 'PHP' | 'USD')}>
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            ) : null}
            {generationPricingMode !== 'unpriced' ? (
              <label className="scene-brief-field">
                <span>Optional generation ceiling ({generationPricingMode === 'credits' ? 'credits' : generationCurrency})</span>
                <input aria-label="Optional AI-generation ceiling" type="number" min="1" step="1" value={generationCeiling} onChange={(event) => setGenerationCeiling(event.target.value)} />
              </label>
            ) : null}
            <label className="scene-brief-field">
              <span>Maximum attempts</span>
              <input aria-label="Maximum generation attempts" type="number" min="1" max="20" step="1" value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} />
            </label>
          </div>
          {errors.generationBudget ? <strong className="scene-brief-section-error" role="alert">{errors.generationBudget}</strong> : null}
        </fieldset>

        <fieldset id="scene-brief-productionConstraints" className="scene-brief-section scene-brief-wide" tabIndex={-1}>
          <legend>Physical-production constraints</legend>
          <div className="scene-brief-grid">
            <label className="scene-brief-field">
              <span>Production budget band</span>
              <select aria-label="Physical-production budget band" value={productionBudgetBand} onChange={(event) => setProductionBudgetBand(event.target.value as ScenePlanningBrief['productionConstraints']['budgetBand'])}>
                <option value="micro">Micro</option>
                <option value="lean">Lean</option>
                <option value="indie">Indie</option>
                <option value="custom">Custom</option>
              </select>
              <small>{productionBudgetHelp}</small>
            </label>
            <label className="scene-brief-field">
              <span>Production currency</span>
              <select aria-label="Physical-production currency" value={productionCurrency} onChange={(event) => setProductionCurrency(event.target.value as 'PHP' | 'USD')}>
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className="scene-brief-field">
              <span>Optional physical-production ceiling ({productionCurrency})</span>
              <input aria-label="Optional physical-production ceiling" type="number" min="1" step="1" value={productionBudgetCeiling} onChange={(event) => setProductionBudgetCeiling(event.target.value)} />
            </label>
            <label className="scene-brief-field">
              <span>Available equipment (optional)</span>
              <textarea aria-label="Available equipment (optional)" rows={3} value={availableEquipment} onChange={(event) => setAvailableEquipment(event.target.value)} />
              <small>One item per line. This shapes practical coverage without changing AI-provider spend.</small>
            </label>
          </div>
          {errors.productionConstraints ? <strong className="scene-brief-section-error" role="alert">{errors.productionConstraints}</strong> : null}
        </fieldset>

        {providerMode === 'live' ? (
          <div className="scene-brief-live-consent scene-brief-wide" role="note">
            <strong>Live research and planning</strong>
            <label>
              <input id="scene-brief-liveProviderConsent" type="checkbox" checked={liveProviderConsent} onChange={(event) => setLiveProviderConsent(event.target.checked)} aria-invalid={Boolean(errors.liveProviderConsent)} aria-describedby={errors.liveProviderConsent ? 'scene-brief-live-consent-error' : 'scene-brief-live-consent-help'} />
              <span>Send this scene brief and constraints to Parallel and Google Vertex AI.</span>
            </label>
            <small id="scene-brief-live-consent-help">Cineserye sends only the selected scene brief, normalized research, and planning constraints. It never sends API keys or the full project file.</small>
            {errors.liveProviderConsent ? <span id="scene-brief-live-consent-error" role="alert">{errors.liveProviderConsent}</span> : null}
          </div>
        ) : null}

        <footer>
          <p>AI-generation estimates are illustrative and never compared with the physical-production ceiling.</p>
          <div>
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Generate shot plan</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
