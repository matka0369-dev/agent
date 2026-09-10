import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, Portal } from './shared';
import './shared/styles.css';
import { Dashboard } from './Dashboard';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Portal accountTypes={['AGENT', 'AGENT_STAFF']}>
        <Dashboard />
      </Portal>
    </AuthProvider>
  </StrictMode>,
);
