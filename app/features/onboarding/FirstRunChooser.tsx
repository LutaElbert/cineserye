'use client';

import { Clapperboard, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function FirstRunChooser({
  providerMode,
  onStartScene,
  onExploreSample,
}: {
  providerMode: 'loading' | 'fixture' | 'live';
  onStartScene: () => void;
  onExploreSample: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    startRef.current?.focus();
    return () => dialog?.close();
  }, []);

  const modeLabel = providerMode === 'live'
    ? 'Live mode is configured. Nothing is sent until you review a scene brief and consent.'
    : providerMode === 'fixture'
      ? 'Fixture mode is active. Planning stays deterministic and offline.'
      : 'Provider status is still loading. You can safely begin locally.';

  return (
    <dialog ref={dialogRef} className="first-run-dialog" aria-labelledby="first-run-title">
      <div className="first-run-content">
        <header>
          <span className="brand-mark" aria-hidden="true">C</span>
          <div>
            <span className="eyebrow">Welcome to Cineserye</span>
            <h1 id="first-run-title">Start with your scene—or study a finished example.</h1>
            <p>Cineserye turns one scene into a reviewable, continuity-aware shot proposal without changing your canvas until you accept it.</p>
          </div>
        </header>
        <div className="first-run-options">
          <button ref={startRef} type="button" className="first-run-option" onClick={onStartScene}>
            <Clapperboard size={20} aria-hidden="true" />
            <span><strong>Start a scene</strong><small>Open the clean Story Premise → Scene 01 → Shot 01 workspace.</small></span>
          </button>
          <button type="button" className="first-run-option" onClick={onExploreSample}>
            <Sparkles size={20} aria-hidden="true" />
            <span><strong>Explore the sample</strong><small>Open The Reel That Knows Tomorrow with its accepted plan and fixture sources.</small></span>
          </button>
        </div>
        <footer>
          <span className={`provider-mode-badge mode-${providerMode === 'live' ? 'live' : 'fixture'}`}>
            {providerMode === 'live' ? 'Live mode' : providerMode === 'fixture' ? 'Fixture mode' : 'Checking provider'}
          </span>
          <p>{modeLabel}</p>
        </footer>
      </div>
    </dialog>
  );
}
