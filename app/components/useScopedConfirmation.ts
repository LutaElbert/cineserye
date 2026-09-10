'use client';

import { useState } from 'react';

/** UI approval is invalidated synchronously, before a changed scope can submit. */
export function useScopedConfirmation(scope: string) {
  const [approval, setApproval] = useState({ scope, confirmed: false });
  if (approval.scope !== scope) setApproval({ scope, confirmed: false });
  return [
    approval.scope === scope && approval.confirmed,
    (confirmed: boolean) => setApproval({ scope, confirmed }),
  ] as const;
}
