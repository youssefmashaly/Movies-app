import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { validateEnv, initGlobalErrorCapture, initPerformanceMetrics, recordStartupTiming } from './lib/analytics.ts';
import './lib/diagnostics.ts';
import './index.css';

recordStartupTiming();
validateEnv();
initGlobalErrorCapture();
initPerformanceMetrics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
