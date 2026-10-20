import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LoginPage from './zite/LoginPage';
import AuthCallback from './zite/AuthCallback';
import './index.css';

const path = window.location.pathname;
const isCallback = path === '/auth/callback' || path.startsWith('/auth/callback');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isCallback ? <AuthCallback /> : path === '/login' ? <LoginPage /> : <App />}
  </StrictMode>,
);

// Auto-reload on Vite chunk load error after deployment
window.addEventListener('vite:preloadError', (event) => {
  event?.preventDefault();
  window.location.reload();
});

// Register PWA Service Worker for offline capability & mobile installability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA service worker registration failed:', err);
    });
  });
}

