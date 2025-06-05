import React from 'react';
import ReactDOM from 'react-dom/client'; // Pour React 18+
import './index.css'; // Si vous avez un fichier CSS global
import App from './App'; // Importe le composant principal de l'application
import reportWebVitals from './reportWebVitals'; // Pour mesurer les performances

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Si vous voulez mesurer les performances de votre application
// Passez une fonction pour logger les résultats (par exemple: reportWebVitals(console.log))
// ou envoyez-les à un point d'analyse.
reportWebVitals();