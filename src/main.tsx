import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PortalProvider } from './state/PortalContext';
import { NewsProvider } from './state/NewsContext';
import { ToastProvider } from './state/ToastContext';
import { applyExtensionMode } from './services/extension';

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <ToastProvider>
        <PortalProvider>
          <NewsProvider>
            <App />
          </NewsProvider>
        </PortalProvider>
      </ToastProvider>
    </StrictMode>,
  );
}

void applyExtensionMode()
  .catch(() => undefined)
  .finally(render);
