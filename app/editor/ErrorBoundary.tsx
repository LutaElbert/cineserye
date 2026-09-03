'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ConfirmationDialog, type ConfirmationDialogOptions } from '../components/ConfirmationDialog';
import { clearLocalDocument } from './persistence';

type Props = { children: ReactNode };
type State = {
  failed: boolean;
  resetConfirmationOpen: boolean;
  resetting: boolean;
  resetError: string | null;
};

const RESET_CONFIRMATION: ConfirmationDialogOptions = {
  tone: 'danger',
  eyebrow: 'Local project reset',
  title: 'Reset saved local project?',
  description: 'The Cineserye project saved in this browser will be permanently deleted.',
  impact: 'This action cannot be undone.',
  reassurance: 'Reload the editor first and use reset only if the problem continues.',
  confirmLabel: 'Reset local project',
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    failed: false,
    resetConfirmationOpen: false,
    resetting: false,
    resetError: null,
  };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') console.error(error, info);
  }

  private resetLocalProject = async () => {
    if (this.state.resetting) return;
    this.setState({ resetConfirmationOpen: false, resetting: true, resetError: null });
    try {
      await clearLocalDocument();
      window.location.reload();
    } catch {
      this.setState({
        resetting: false,
        resetError: 'The saved project could not be reset. Reload the editor or download your browser data before trying again.',
      });
    }
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error">
        <div>
          <span className="brand-mark" aria-hidden="true">C</span>
          <h1>The editor needs to restart</h1>
          <p>Your locally saved project is still on this device. Reload first; reset only if the problem continues.</p>
          {this.state.resetError ? <p role="alert">{this.state.resetError}</p> : null}
          <div className="fatal-actions">
            <button type="button" className="primary-button" disabled={this.state.resetting} onClick={() => window.location.reload()}>
              Reload editor
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={this.state.resetting}
              onClick={() => this.setState({ resetConfirmationOpen: true, resetError: null })}
            >
              {this.state.resetting ? 'Resetting…' : 'Reset local project'}
            </button>
          </div>
        </div>
        <ConfirmationDialog
          request={this.state.resetConfirmationOpen ? RESET_CONFIRMATION : null}
          onCancel={() => this.setState({ resetConfirmationOpen: false })}
          onConfirm={() => void this.resetLocalProject()}
        />
      </main>
    );
  }
}
