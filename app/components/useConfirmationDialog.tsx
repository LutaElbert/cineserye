'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ConfirmationDialog, type ConfirmationDialogOptions } from './ConfirmationDialog';

export function useConfirmationDialog() {
  const pendingRef = useRef<{
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const [request, setRequest] = useState<ConfirmationDialogOptions | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setRequest(null);
    pending.resolve(confirmed);
  }, []);

  const confirm = useCallback((nextRequest: ConfirmationDialogOptions) => new Promise<boolean>((resolve) => {
    pendingRef.current?.resolve(false);
    pendingRef.current = { resolve };
    setRequest(nextRequest);
  }), []);

  useEffect(() => () => {
    pendingRef.current?.resolve(false);
    pendingRef.current = null;
  }, []);

  return {
    confirm,
    confirmationDialog: (
      <ConfirmationDialog
        request={request}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ),
  };
}
