import { useState, useRef, useEffect } from 'react';
import { StrudelMirror } from '@strudel/codemirror';
import { getAudioContext, webaudioOutput } from '@strudel/webaudio';
import { silence } from '@strudel/core';
import { transpiler } from '@strudel/transpiler';
import { useSegmentWaveform } from '../../hooks/useSegmentWaveform';

const CARD_COLORS = [
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#45b7d1', // blue
  '#f9ca24', // yellow
  '#6c5ce7', // purple
  '#fd79a8', // pink
  '#00b894', // green
  '#fdcb6e', // orange
];

export function WaveformCard({
  code,
  name,
  uniqueId,
  onAddToTimeline,
  playingPreviewId,
  setPlayingPreviewId,
  hasTimeline,
  validation,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTrackSelector, setShowTrackSelector] = useState(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const isPlaying = playingPreviewId === uniqueId;
  const cardColor = CARD_COLORS[Math.abs(hashCode(uniqueId)) % CARD_COLORS.length];

  // Initialize editor on mount (always render, just hide when collapsed)
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const editor = new StrudelMirror({
        root: containerRef.current,
        initialCode: code,
        pattern: silence,
        defaultOutput: webaudioOutput,
        getTime: () => getAudioContext().currentTime,
        transpiler,
        prebake: async () => Promise.resolve(),
        drawTime: [0, 0],
        bgFill: false,
        solo: false,
        enableKeyboard: false,
      });
      editorRef.current = editor;
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.repl?.stop();
      }
    };
  }, [code]);

  // Stop preview when another starts
  useEffect(() => {
    if (!isPlaying && editorRef.current) {
      editorRef.current.repl?.stop();
    }
  }, [isPlaying]);

  // Waveform visualization
  useSegmentWaveform(canvasRef.current, uniqueId, isPlaying, cardColor, {
    fftSize: 2048,
    smoothingTimeConstant: 0.5,
    captureFrames: 60,
  });

  const handlePlay = () => {
    if (editorRef.current) {
      if (isPlaying) {
        editorRef.current.repl?.stop();
        setPlayingPreviewId(null);
      } else {
        editorRef.current.evaluate();
        setPlayingPreviewId(uniqueId);
      }
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const hasError = validation && !validation.valid;

  return (
    <div className="mb-3 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
      {/* Card Header with Waveform */}
      <div
        className="relative h-20 cursor-pointer"
        style={{ backgroundColor: cardColor }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Waveform Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none opacity-30"
          width={400}
          height={80}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Card Content Overlay */}
        <div className="relative h-full flex items-center justify-between px-4 z-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {name || 'Untitled'}
            </h3>
            {hasError && (
              <p className="text-xs text-red-200 truncate">
                Error: {validation.error.message}
              </p>
            )}
          </div>

          {/* Expand/Collapse Icon */}
          <svg
            className={`w-5 h-5 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 flex gap-2 flex-wrap border-t border-gray-300 dark:border-gray-600">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          disabled={hasError}
          className={`px-3 py-1.5 text-white text-xs font-medium rounded shadow-md transition-colors flex items-center gap-1 ${
            hasError
              ? 'bg-gray-400 cursor-not-allowed'
              : isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
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

        {hasTimeline && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTrackSelector(!showTrackSelector);
            }}
            disabled={hasError}
            className={`px-3 py-1.5 text-white text-xs font-medium rounded shadow-md transition-colors flex items-center gap-1 ${
              hasError
                ? 'bg-gray-400 cursor-not-allowed'
                : showTrackSelector
                ? 'bg-purple-700 hover:bg-purple-800'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" />
            </svg>
            Add to Timeline
          </button>
        )}
      </div>

      {/* Track Selector */}
      {showTrackSelector && hasTimeline && onAddToTimeline && (
        <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 border-t border-gray-300 dark:border-gray-600">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select track:
          </div>
          <div className="flex flex-col gap-1">
            {onAddToTimeline.tracks?.length > 0 ? (
              onAddToTimeline.tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => {
                    onAddToTimeline.addSegment(track.id, code);
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
                  onAddToTimeline.addSegment(null, code);
                  setShowTrackSelector(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Track & Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* Code View - Always rendered but hidden when collapsed */}
      <div className="border-t border-gray-300 dark:border-gray-600" style={{
        maxHeight: isExpanded ? '362px' : '0',
        opacity: isExpanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s ease, opacity 0.3s ease'
      }}>
        <div
          ref={containerRef}
          className="bg-gray-900 text-gray-100 overflow-auto"
          style={{ minHeight: '120px', maxHeight: '300px' }}
        />

        {/* Copy Button */}
        <div className="bg-gray-800 px-3 py-2 flex justify-end">
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Code
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple hash function for consistent color selection
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}
