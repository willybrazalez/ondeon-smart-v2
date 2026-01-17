import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// 🔧 Importar supabase para exponer funciones de limpieza globalmente
import './lib/supabase';
// 🌐 Inicializar i18n
import './i18n/config';

ReactDOM.createRoot(document.getElementById('root')).render(
  // Nota: desactivamos StrictMode en desarrollo para evitar dobles montajes
  // que disparan efectos e inicializaciones dos veces.
  <App />
);
