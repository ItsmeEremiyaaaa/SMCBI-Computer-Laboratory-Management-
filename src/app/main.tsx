import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, savedTheme } from './TopBar';
import { AuthProvider } from '../modules/auth/hooks/auth';
import { ConfirmHost, ToastHost } from '../shared/ui/ui';
import './index.css';

applyTheme(savedTheme()); // before the first paint, so dark mode never flashes white

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider><App /><ConfirmHost /><ToastHost /></AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
