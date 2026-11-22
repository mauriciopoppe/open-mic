import { html, render, useCallback, useEffect, useState } from 'htm/preact';
import { preloadPianoSamples } from './piano-audio.js';
import { PracticeRoom } from './practice-room.js';
import { SongLab } from './song-lab.js';

const DEFAULT_SONG_ID = 'japanese-denim';

function stripLegacyCacheQuery() {
  if (!location.search.includes('v=')) return;
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('v')) return;
    url.searchParams.delete('v');
    const cleanSearch = url.searchParams.toString();
    history.replaceState(
      null,
      '',
      `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${url.hash}`
    );
  } catch {
    // Ignore malformed URLs in non-standard environments.
  }
}

function parseHashRoute(hashValue, fallbackSongId) {
  if (!hashValue || hashValue === '#practice') {
    return { route: 'practice', songId: fallbackSongId, normalized: false };
  }
  const match = hashValue.match(/^#karaoke\/([a-z0-9-]+)$/);
  if (match) {
    return { route: 'karaoke', songId: match[1], normalized: false };
  }
  return { route: 'practice', songId: fallbackSongId, normalized: true };
}

function Topbar({ route, activeSongId, pianoStatus }) {
  return html`
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">♩</div>
        <div class="brand-copy">
          <strong>Voice</strong>
          <span>your private vocal room</span>
        </div>
      </div>
      <nav class="top-nav" aria-label="Voice pages">
        <a
          href="#practice"
          data-route-link="practice"
          class=${route === 'practice' ? 'active' : ''}
          aria-current=${route === 'practice' ? 'page' : undefined}
        >
          Practice Room
        </a>
        <a
          href=${`#karaoke/${activeSongId}`}
          data-route-link="karaoke"
          class=${route === 'karaoke' ? 'active' : ''}
          aria-current=${route === 'karaoke' ? 'page' : undefined}
        >
          Song Lab
        </a>
      </nav>
      <div class="pill">
        <span class="dot"></span>${' '}
        <span id="pianoStatusText">${pianoStatus}</span>
      </div>
    </header>
  `;
}

export function App() {
  const [routeState, setRouteState] = useState(() => {
    stripLegacyCacheQuery();
    const initial = parseHashRoute(location.hash, DEFAULT_SONG_ID);
    if (initial.normalized) {
      history.replaceState(null, '', '#practice');
    }
    return { route: initial.route, songId: initial.songId };
  });
  const [pianoStatus, setPianoStatus] = useState('grand piano loading…');
  const [loadedSongTitle, setLoadedSongTitle] = useState('');

  const syncFromLocation = useCallback(() => {
    setRouteState((prev) => {
      const parsed = parseHashRoute(location.hash, prev.songId);
      if (parsed.normalized) {
        history.replaceState(null, '', '#practice');
      }
      if (prev.route === parsed.route && prev.songId === parsed.songId) {
        return prev;
      }
      return { route: parsed.route, songId: parsed.songId };
    });
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncFromLocation);
    window.addEventListener('popstate', syncFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncFromLocation);
      window.removeEventListener('popstate', syncFromLocation);
    };
  }, [syncFromLocation]);

  useEffect(() => {
    preloadPianoSamples(setPianoStatus);
  }, []);

  useEffect(() => {
    if (routeState.route === 'karaoke') {
      document.title = loadedSongTitle
        ? `${loadedSongTitle} · Song Lab · Voice`
        : 'Song Lab · Voice';
    } else {
      document.title = 'Practice Room · Voice';
    }
  }, [loadedSongTitle, routeState.route]);

  return html`
    <${Topbar}
      route=${routeState.route}
      activeSongId=${routeState.songId}
      pianoStatus=${pianoStatus}
    />
    <${PracticeRoom}
      active=${routeState.route === 'practice'}
      onStatusChange=${setPianoStatus}
    />
    <${SongLab}
      active=${routeState.route === 'karaoke'}
      songId=${routeState.songId}
      onLoadedSongTitle=${setLoadedSongTitle}
    />
  `;
}

const mountNode = document.getElementById('app');
if (mountNode) {
  render(html`<${App} />`, mountNode);
}
