'use client';

import { BookOpen, Clapperboard, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function FirstRunChooser({
  providerMode,
  onStartScene,
  onStartIdea,
  onExploreSample,
}: {
  providerMode: 'loading' | 'fixture' | 'live';
  onStartScene: () => void;
  onStartIdea?: () => void;
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
    ? 'Live mode is configured. Nothing is sent until you review the requested scope and consent.'
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
            <h1 id="first-run-title">{onStartIdea ? 'Start with your scene—or simply share an idea.' : 'Start with your scene—or study a finished example.'}</h1>
            <p>{onStartIdea ? 'Describe a story and let the Assistant help develop it, build scenes manually, or explore an example. You approve what gets created.' : 'Cineserye turns one scene into a reviewable, continuity-aware shot proposal without changing your canvas until you accept it.'}</p>
          </div>
        </header>
        <div className="first-run-options">
          {onStartIdea ? <button ref={startRef} type="button" className="first-run-option" style={{ gridColumn: '1 / -1', borderColor: '#aaa1f5', background: '#f7f5ff' }} onClick={onStartIdea}>
            <BookOpen size={20} aria-hidden="true" />
            <span><strong>Start with an idea</strong><small>One empty Story Premise layer. Add scenes only when you accept a plan or create them yourself.</small></span>
          </button> : null}
          <button ref={onStartIdea ? undefined : startRef} type="button" className="first-run-option" onClick={onStartScene}>
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
