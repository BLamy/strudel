import { useState, useEffect } from 'react';
import { useSettings } from '@src/settings.mjs';
import { WaveformCard } from './WaveformCard';

// LocalStorage key for beat history
const HISTORY_STORAGE_KEY = 'strudel_ai_beat_history';

// Load history from localStorage
function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load beat history:', error);
    return [];
  }
}

// Save history to localStorage
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save beat history:', error);
  }
}

// Add a beat to history
export function addBeatToHistory(code, metadata = {}) {
  const history = loadHistory();
  let beatName = metadata.name || code.split('\n')[0].replace(/^\/\/\s*/, '').slice(0, 50) || 'Untitled';
  // Strip "Variation #:", "Approach #:", etc. prefixes
  beatName = beatName.replace(/^(Variation|Approach)\s+\d+:\s*/i, '');
  const beat = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    code,
    timestamp: Date.now(),
    name: beatName,
    ...metadata,
  };

  // Add to beginning of array (most recent first)
  history.unshift(beat);

  // Keep only last 100 beats to avoid storage limits
  const trimmedHistory = history.slice(0, 100);
  saveHistory(trimmedHistory);

  return beat;
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function HistoryTab({ context }) {
  const { fontFamily } = useSettings();
  const [history, setHistory] = useState(loadHistory());
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Timeline integration
  const timeline = context?.timeline;
  const hasTimeline = Boolean(timeline);

  // Reload history when component mounts or when storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setHistory(loadHistory());
    };

    window.addEventListener('storage', handleStorageChange);

    // Also poll for changes (in case updates happen in same window)
    const interval = setInterval(() => {
      setHistory(loadHistory());
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Handler for adding segment to timeline
  const handleAddToTimeline = {
    tracks: timeline?.tracks || [],
    addSegment: (trackId, code) => {
      if (timeline?.addSegment && timeline?.addTrack) {
        // If no tracks exist, create a default track first
        let targetTrackId = trackId;
        if (timeline.tracks.length === 0) {
          targetTrackId = timeline.addTrack('Track 1');
        }

        // Extract a name from the code or use a default
        let segmentName = code.split('\n')[0].replace(/^\/\/\s*/, '').slice(0, 30) || 'Untitled';
        // Strip "Variation #:", "Approach #:", etc. prefixes
        segmentName = segmentName.replace(/^(Variation|Approach)\s+\d+:\s*/i, '');
        timeline.addSegment(targetTrackId, {
          code,
          startTime: timeline.playheadPosition || 0,
          duration: 8, // Default 8 seconds
          name: segmentName,
        });
      }
    },
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all beat history? This cannot be undone.')) {
      saveHistory([]);
      setHistory([]);
    }
  };

  // Filter history based on search query
  const filteredHistory = searchQuery.trim()
    ? history.filter((beat) =>
        beat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        beat.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  return (
    <div className="flex flex-col h-full min-w-full pt-2 font-sans pb-4 px-4" style={{ fontFamily }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Beat History</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {history.length} beat{history.length !== 1 ? 's' : ''}
          </span>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              title="Clear all history"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search beats..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            {searchQuery.trim() ? (
              <>
                <p className="mb-2">No beats found matching "{searchQuery}"</p>
              </>
            ) : (
              <>
                <p className="mb-2">No beats in history yet</p>
                <p className="text-sm">Beats generated by the AI assistant will appear here</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {filteredHistory.map((beat) => (
              <WaveformCard
                key={beat.id}
                code={beat.code}
                name={beat.name}
                uniqueId={beat.id}
                onAddToTimeline={handleAddToTimeline}
                playingPreviewId={playingPreviewId}
                setPlayingPreviewId={setPlayingPreviewId}
                hasTimeline={hasTimeline}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
