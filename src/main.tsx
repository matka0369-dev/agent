import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, Portal } from './shared';
import './shared/styles.css';
import { Dashboard } from './Dashboard';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Portal accountTypes={['AGENT', 'AGENT_STAFF']}>
          <Dashboard />
        </Portal>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
