import { useState, useEffect, useRef } from 'react';
import { useSettings } from '@src/settings.mjs';
import { transpiler } from '@strudel/transpiler';
import { StrudelMirror } from '@strudel/codemirror';
import { getAudioContext, webaudioOutput } from '@strudel/webaudio';
import { silence } from '@strudel/core';

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
  const beat = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    code,
    timestamp: Date.now(),
    name: metadata.name || code.split('\n')[0].replace(/^\/\/\s*/, '').slice(0, 50) || 'Untitled',
    ...metadata,
  };

  // Add to beginning of array (most recent first)
  history.unshift(beat);

  // Keep only last 100 beats to avoid storage limits
  const trimmedHistory = history.slice(0, 100);
  saveHistory(trimmedHistory);

  return beat;
}

// Preview component for individual beat
function BeatPreview({ beat, onInsertCode, onAddToTimeline, playingPreviewId, setPlayingPreviewId, hasTimeline }) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [showTrackSelector, setShowTrackSelector] = useState(false);
  const isPlaying = playingPreviewId === beat.id;

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const editor = new StrudelMirror({
        root: containerRef.current,
        initialCode: beat.code,
        pattern: silence,
        defaultOutput: webaudioOutput,
        getTime: () => getAudioContext().currentTime,
        transpiler,
        prebake: async () => Promise.resolve(),
        drawTime: [0, 0],
        bgFill: false,
        solo: false,
        enableKeyboard: false, // Disable keyboard shortcuts to prevent conflicts
      });
      editorRef.current = editor;
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.repl?.stop();
      }
    };
  }, [beat.code]);

  // Stop this preview when another one starts playing
  useEffect(() => {
    if (!isPlaying && editorRef.current) {
      editorRef.current.repl?.stop();
    }
  }, [isPlaying]);

  const handlePlay = () => {
    if (editorRef.current) {
      if (isPlaying) {
        editorRef.current.repl?.stop();
        setPlayingPreviewId(null);
      } else {
        editorRef.current.evaluate();
        setPlayingPreviewId(beat.id);
      }
    }
  };

  const handleInsert = () => {
    onInsertCode(beat.code);
  };

  const formatDate = (timestamp) => {
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
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden mb-3">
      <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-b border-gray-300 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {beat.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(beat.timestamp)}
            </div>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-gray-900 text-gray-100 overflow-auto"
        style={{ minHeight: '100px', maxHeight: '250px' }}
      />

      <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2 flex gap-2 flex-wrap border-t border-gray-300 dark:border-gray-600">
        <button
          onClick={handlePlay}
          className={`px-3 py-1.5 text-white text-xs font-medium rounded shadow-md transition-colors flex items-center gap-1 ${
            isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          title={isPlaying ? 'Stop preview' : 'Play preview'}
        >
          {isPlaying ? (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Stop
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Play
            </>
          )}
        </button>
        <button
          onClick={handleInsert}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-md transition-colors flex items-center gap-1"
          title="Insert code into main editor and play"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Insert
        </button>
        {hasTimeline && (
          <button
            onClick={() => setShowTrackSelector(!showTrackSelector)}
            className={`px-3 py-1.5 text-white text-xs font-medium rounded shadow-md transition-colors flex items-center gap-1 ${
              showTrackSelector
                ? 'bg-purple-700 hover:bg-purple-800'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
            title="Add segment to timeline"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" />
            </svg>
            Add to Timeline
          </button>
        )}
      </div>

      {showTrackSelector && hasTimeline && onAddToTimeline && (
        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-t border-gray-300 dark:border-gray-600">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select track to add segment:
          </div>
          <div className="flex flex-col gap-1">
            {onAddToTimeline.tracks?.length > 0 ? (
              onAddToTimeline.tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => {
                    onAddToTimeline.addSegment(track.id, beat.code);
                    setShowTrackSelector(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1 text-xs rounded bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: track.color }}
                  />
                  <span className="text-gray-900 dark:text-gray-100">{track.name}</span>
                </button>
              ))
            ) : (
              <button
                onClick={() => {
                  onAddToTimeline.addSegment(null, beat.code);
                  setShowTrackSelector(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Create Track & Add Segment</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

  const handleInsertCode = (code) => {
    if (context?.editorRef?.current) {
      // Stop any playing preview
      setPlayingPreviewId(null);

      // Set the code in the editor
      context.editorRef.current.setCode(code);

      // Evaluate the code to make it play
      if (context.editorRef.current.evaluate) {
        context.editorRef.current.evaluate();
      }
    }
  };

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
        const segmentName = code.split('\n')[0].replace(/^\/\/\s*/, '').slice(0, 30) || 'Untitled';
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
              <BeatPreview
                key={beat.id}
                beat={beat}
                onInsertCode={handleInsertCode}
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
