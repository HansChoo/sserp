/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceShell } from './components/WorkspaceShell';
import { ErpProvider, useErp } from './context/ErpContext';

function AppRoot() {
  const { authReady, firebaseUser, currentEmployee, dataLoading, seeding } =
    useErp();

  if (
    !authReady ||
    !firebaseUser ||
    dataLoading ||
    seeding ||
    !currentEmployee
  ) {
    return <AuthGate />;
  }

  return <WorkspaceShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErpProvider>
        <AppRoot />
      </ErpProvider>
    </ErrorBoundary>
  );
}
