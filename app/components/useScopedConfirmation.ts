'use client';

import { useState } from 'react';

/** UI approval is invalidated synchronously, before a changed scope can submit. */
export function useScopedConfirmation(scope: string, authority?: unknown) {
  const [approval, setApproval] = useState({ scope, authority, confirmed: false });
  if (approval.scope !== scope || approval.authority !== authority) setApproval({ scope, authority, confirmed: false });
  return [
    approval.scope === scope && approval.authority === authority && approval.confirmed,
    (confirmed: boolean) => setApproval({ scope, authority, confirmed }),
  ] as const;
}
