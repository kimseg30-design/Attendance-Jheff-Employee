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
