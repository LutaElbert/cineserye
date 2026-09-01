'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  SceneBriefValidationError,
  validateScenePlanningBrief,
  type ScenePlanningBrief,
} from '../../domain/cinema/scene-brief';

export type SceneBriefDefaults = ScenePlanningBrief;

type FieldErrors = Partial<Record<SceneBriefValidationError['field'] | 'liveProviderConsent', string>>;

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
  const toneRef = useRef<HTMLInputElement>(null);
  const [tone, setTone] = useState(defaults.tone);
  const [locationPeriod, setLocationPeriod] = useState(defaults.locationPeriod);
  const [budgetBand, setBudgetBand] = useState(defaults.budgetBand);
  const [budgetCeiling, setBudgetCeiling] = useState(
    defaults.budgetCeiling === null ? '' : String(defaults.budgetCeiling),
  );
  const [targetDurationSeconds, setTargetDurationSeconds] = useState(String(defaults.targetDurationSeconds));
  const [availableEquipment, setAvailableEquipment] = useState(defaults.availableEquipment.join('\n'));
  const [liveProviderConsent, setLiveProviderConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    toneRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const budgetHelp = useMemo(() => ({
    micro: 'A tiny test or creator-credit budget with strict reuse.',
    lean: 'A practical indie package with limited retries and a few hero moments.',
    indie: 'More room for reference generation, retries, and complex shots.',
    custom: 'Use your own production band and optional ceiling.',
  })[budgetBand], [budgetBand]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (providerMode === 'live' && !liveProviderConsent) {
        setErrors({ liveProviderConsent: 'Confirm the live provider content transfer to continue.' });
        window.requestAnimationFrame(() => document.getElementById('scene-brief-liveProviderConsent')?.focus());
        return;
      }
      const brief = validateScenePlanningBrief({
        ...defaults,
        tone,
        locationPeriod,
        budgetBand,
        budgetCeiling: budgetCeiling.trim() ? Number(budgetCeiling) : null,
        targetDurationSeconds: Number(targetDurationSeconds),
        availableEquipment: availableEquipment.split('\n'),
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
          <span className="eyebrow">One-scene preflight</span>
          <h2 id="scene-brief-title">Plan this scene</h2>
          <p>Confirm the constraints the research and shot-planning agents must respect.</p>
        </header>

        <label className="scene-brief-field scene-brief-wide">
          <span>Selected scene text</span>
          <textarea id="scene-brief-sceneText" value={defaults.sceneText} readOnly rows={3} />
          <small>Cineserye reads this directly from the selected scene node.</small>
          {errors.sceneText ? <strong role="alert">{errors.sceneText}</strong> : null}
        </label>

        <div className="scene-brief-grid">
          <label className="scene-brief-field">
            <span>Tone</span>
            <input
              id="scene-brief-tone"
              ref={toneRef}
              aria-label="Tone"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              aria-invalid={Boolean(errors.tone)}
              aria-describedby={errors.tone ? 'scene-brief-tone-error' : undefined}
            />
            {errors.tone ? <strong id="scene-brief-tone-error" role="alert">{errors.tone}</strong> : null}
          </label>

          <label className="scene-brief-field">
            <span>Location and period</span>
            <input
              id="scene-brief-locationPeriod"
              aria-label="Location and period"
              value={locationPeriod}
              onChange={(event) => setLocationPeriod(event.target.value)}
              aria-invalid={Boolean(errors.locationPeriod)}
              aria-describedby={errors.locationPeriod ? 'scene-brief-location-error' : undefined}
            />
            {errors.locationPeriod ? <strong id="scene-brief-location-error" role="alert">{errors.locationPeriod}</strong> : null}
          </label>

          <label className="scene-brief-field">
            <span>Production budget band</span>
            <select
              id="scene-brief-budgetBand"
              aria-label="Production budget band"
              value={budgetBand}
              onChange={(event) => setBudgetBand(event.target.value as ScenePlanningBrief['budgetBand'])}
            >
              <option value="micro">Micro</option>
              <option value="lean">Lean</option>
              <option value="indie">Indie</option>
              <option value="custom">Custom</option>
            </select>
            <small>{budgetHelp}</small>
          </label>

          <label className="scene-brief-field">
            <span>Optional ceiling ({defaults.currency})</span>
            <input
              id="scene-brief-budgetCeiling"
              aria-label={`Optional ceiling (${defaults.currency})`}
              type="number"
              min="1"
              step="1"
              value={budgetCeiling}
              onChange={(event) => setBudgetCeiling(event.target.value)}
              aria-invalid={Boolean(errors.budgetCeiling)}
              aria-describedby={errors.budgetCeiling ? 'scene-brief-budget-error' : undefined}
            />
            {errors.budgetCeiling ? <strong id="scene-brief-budget-error" role="alert">{errors.budgetCeiling}</strong> : null}
          </label>

          <label className="scene-brief-field">
            <span>Target duration (seconds)</span>
            <input
              id="scene-brief-targetDurationSeconds"
              aria-label="Target duration (seconds)"
              type="number"
              min="6"
              max="180"
              step="1"
              value={targetDurationSeconds}
              onChange={(event) => setTargetDurationSeconds(event.target.value)}
              aria-invalid={Boolean(errors.targetDurationSeconds)}
              aria-describedby={errors.targetDurationSeconds ? 'scene-brief-duration-error' : undefined}
            />
            {errors.targetDurationSeconds ? <strong id="scene-brief-duration-error" role="alert">{errors.targetDurationSeconds}</strong> : null}
          </label>

          <label className="scene-brief-field">
            <span>Available equipment (optional)</span>
            <textarea
              id="scene-brief-availableEquipment"
              aria-label="Available equipment (optional)"
              rows={3}
              value={availableEquipment}
              onChange={(event) => setAvailableEquipment(event.target.value)}
            />
            <small>One item per line. This can reduce risky or impractical shot choices.</small>
          </label>
        </div>

        {providerMode === 'live' ? (
          <div className="scene-brief-live-consent scene-brief-wide" role="note">
            <strong>Live research and planning</strong>
            <label>
              <input
                id="scene-brief-liveProviderConsent"
                type="checkbox"
                checked={liveProviderConsent}
                onChange={(event) => setLiveProviderConsent(event.target.checked)}
                aria-invalid={Boolean(errors.liveProviderConsent)}
                aria-describedby={errors.liveProviderConsent ? 'scene-brief-live-consent-error' : 'scene-brief-live-consent-help'}
              />
              <span>Send this scene brief and constraints to Parallel and Google Vertex AI.</span>
            </label>
            <small id="scene-brief-live-consent-help">Cineserye sends only the selected scene brief, normalized research, and planning constraints. It never sends API keys or the full project file.</small>
            {errors.liveProviderConsent ? <span id="scene-brief-live-consent-error" role="alert">{errors.liveProviderConsent}</span> : null}
          </div>
        ) : null}

        <footer>
          <p>Costs will remain illustrative generation estimates—not guaranteed production quotes.</p>
          <div>
            <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary-button">Research and draft shots</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
