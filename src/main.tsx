import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/im-fell-english-sc/400.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './ui/styles.css';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
