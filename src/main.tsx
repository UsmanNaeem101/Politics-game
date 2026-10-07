import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { GameState } from './engine';
import { App } from './ui/App';
import './ui/styles.css';

function start(data?: unknown) {
  const initial = (data as { game?: GameState } | undefined)?.game ?? null;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App initial={initial && initial.phase === 'playing' ? initial : null} />
    </StrictMode>,
  );
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data);
