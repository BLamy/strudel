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
  isFavorite,
  onToggleFavorite,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const cardRef = useRef(null);

  const isPlaying = playingPreviewId === uniqueId;
  const cardColor = CARD_COLORS[Math.abs(hashCode(uniqueId)) % CARD_COLORS.length];

  // Initialize editor on mount (always render, just hide when collapsed)
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      // Wrap code with .analyze() to route audio to analyser
      const wrappedCode = `(${code.trim()}).analyze("${uniqueId}")`;

      const editor = new StrudelMirror({
        root: containerRef.current,
        initialCode: wrappedCode,
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
  }, [code, uniqueId]);

  // Stop preview when another starts
  useEffect(() => {
    if (!isPlaying && editorRef.current) {
      editorRef.current.repl?.stop();
    }
  }, [isPlaying]);

  // Waveform visualization - use white for visibility on colored background
  useSegmentWaveform(canvasRef.current, uniqueId, isPlaying, '#ffffff', {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    lineWidth: 2,
    scale: 0.8,
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

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (hasError || !hasTimeline || !onAddToTimeline) return;

    // Find the rightmost segment across all tracks to determine end time
    let maxEndTime = 0;
    if (onAddToTimeline.tracks) {
      onAddToTimeline.tracks.forEach(track => {
        track.segments?.forEach(segment => {
          const endTime = segment.startTime + segment.duration;
          if (endTime > maxEndTime) {
            maxEndTime = endTime;
          }
        });
      });
    }

    // Create a new track and add the segment at the end
    const newTrackId = `track-${Date.now()}`;
    const trackNumber = (onAddToTimeline.tracks?.length || 0) + 1;

    // Use the addSegment function which will create a track if needed
    onAddToTimeline.addSegment(null, code, maxEndTime);
  };

  const hasError = validation && !validation.valid;

  return (
    <div
      ref={cardRef}
      className="mb-3 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
      draggable={!hasError}
      onDragStart={(e) => {
        if (hasError) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('application/strudel-code', JSON.stringify({
          code,
          name: name || 'Untitled',
          uniqueId,
        }));
        e.dataTransfer.effectAllowed = 'copy';

        // Create a custom drag image from the card header only
        if (cardRef.current) {
          const header = cardRef.current.querySelector('.waveform-card-header');
          if (header) {
            // Clone the header element
            const dragImage = header.cloneNode(true);
            dragImage.style.width = `${header.offsetWidth}px`;
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            document.body.appendChild(dragImage);

            // Set the custom drag image
            e.dataTransfer.setDragImage(dragImage, e.nativeEvent.offsetX, e.nativeEvent.offsetY);

            // Remove the temporary element after drag starts
            setTimeout(() => document.body.removeChild(dragImage), 0);
          }
        }
      }}
    >
      {/* Card Header with Waveform */}
      <div
        className="waveform-card-header relative h-20 cursor-pointer"
        style={{ backgroundColor: cardColor }}
        onClick={() => setIsExpanded(!isExpanded)}
        onDoubleClick={handleDoubleClick}
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
        <div className="relative h-full flex items-center gap-2 px-4 z-10">
          {/* Play Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
            disabled={hasError}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors ${
              hasError
                ? 'bg-gray-400 cursor-not-allowed'
                : isPlaying
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-white hover:bg-gray-100'
            }`}
            title={isPlaying ? 'Stop' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>

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

          {/* Favorite Star Button */}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(uniqueId);
              }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center hover:scale-110 transition-transform"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg
                className="w-5 h-5 text-white drop-shadow-md"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          )}

          {/* Expand/Collapse Icon */}
          <svg
            className={`flex-shrink-0 w-5 h-5 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
