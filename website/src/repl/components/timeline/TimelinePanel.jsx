import { useState, useRef, useEffect } from 'react';
import { Track } from './Track';
import { Playhead } from './Playhead';

const PIXELS_PER_SECOND = 50; // Zoom level: pixels per second
const RULER_INTERVAL = 1; // Show marker every 1 second

export function TimelinePanel({ context, onSegmentSelect }) {
  // Use timeline from context instead of creating a new instance
  const timeline = context?.timeline;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [isRenamingSong, setIsRenamingSong] = useState(false);
  const [tempSongName, setTempSongName] = useState('');
  const scrollContainerRef = useRef(null);
  const selectorRef = useRef(null);
  const resizeStartRef = useRef({ y: 0, height: 0 });

  if (!timeline) {
    return null;
  }

  const {
    tracks,
    selectedSegmentId,
    playheadPosition,
    duration,
    currentSongId,
    currentSong,
    addTrack,
    removeTrack,
    updateTrack,
    updateSegment,
    removeSegment,
    selectSegment,
    getSelectedSegment,
    createNewSong,
    switchSong,
    renameSong,
    deleteSong,
    getSongsList,
  } = timeline;

  // Notify parent when segment selection changes
  useEffect(() => {
    const selected = getSelectedSegment();
    if (onSegmentSelect) {
      onSegmentSelect(selected);
    }
  }, [selectedSegmentId, getSelectedSegment, onSegmentSelect]);

  const handleAddTrack = () => {
    addTrack(`Track ${tracks.length + 1}`);
  };

  const handleToggleMute = (trackId) => {
    const track = tracks.find((t) => t.id === trackId);
    if (track) {
      updateTrack(trackId, { muted: !track.muted });
    }
  };

  const handleToggleSolo = (trackId) => {
    const track = tracks.find((t) => t.id === trackId);
    if (track) {
      updateTrack(trackId, { solo: !track.solo });
    }
  };

  const handleCreateNewSong = () => {
    const newSongId = createNewSong(`Song ${getSongsList().length + 1}`);
    switchSong(newSongId);
    setShowSongSelector(false);
  };

  const handleSwitchSong = (songId) => {
    switchSong(songId);
    setShowSongSelector(false);
  };

  const handleStartRename = () => {
    setTempSongName(currentSong?.name || '');
    setIsRenamingSong(true);
    setShowSongSelector(false);
  };

  const handleFinishRename = () => {
    if (tempSongName.trim() && tempSongName !== currentSong?.name) {
      renameSong(currentSongId, tempSongName.trim());
    }
    setIsRenamingSong(false);
  };

  const handleCancelRename = () => {
    setIsRenamingSong(false);
    setTempSongName('');
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setShowSongSelector(false);
        if (isRenamingSong) {
          handleFinishRename();
        }
      }
    };

    if (showSongSelector || isRenamingSong) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSongSelector, isRenamingSong]);

  // Handle resize drag
  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      y: e.clientY,
      height: timelineHeight,
    };
  };

  const handleResizeMove = (e) => {
    if (!isResizing) return;

    const deltaY = resizeStartRef.current.y - e.clientY; // Negative delta means dragging up (increase height)
    const newHeight = Math.max(150, Math.min(800, resizeStartRef.current.height + deltaY));
    setTimelineHeight(newHeight);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, timelineHeight]);

  // Generate time markers for ruler
  const timeMarkers = [];
  for (let i = 0; i <= duration; i += RULER_INTERVAL) {
    timeMarkers.push(i);
  }

  const contentWidth = duration * PIXELS_PER_SECOND;

  return (
    <div className="border-t border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-900 flex flex-col relative">
      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 transition-colors z-30 ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        title="Drag to resize timeline"
      />

      {/* Timeline Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 dark:border-gray-600">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
          >
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isCollapsed ? 'rotate-180' : ''
              }`}
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
          </button>

          {/* Song Selector - Compound Button */}
          <div className="relative" ref={selectorRef}>
            {isRenamingSong ? (
              <input
                type="text"
                value={tempSongName}
                onChange={(e) => setTempSongName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleFinishRename}
                autoFocus
                className="px-3 py-1 text-sm font-semibold text-white bg-gray-700 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ minWidth: '150px' }}
              />
            ) : (
              <div className="flex items-center bg-gray-700 rounded overflow-hidden">
                <button
                  onClick={handleStartRename}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-white hover:bg-gray-600 transition-colors"
                  title="Click to rename song"
                >
                  <span>{currentSong?.name || 'Untitled Song'}</span>
                </button>
                <div className="w-px h-5 bg-gray-600" />
                <button
                  onClick={() => setShowSongSelector(!showSongSelector)}
                  className="px-2 py-1 hover:bg-gray-600 transition-colors"
                  title="Show song list"
                >
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}

            {showSongSelector && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto">
                <div className="py-1">
                  {getSongsList().map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSwitchSong(song.id)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between ${
                        song.id === currentSongId ? 'bg-gray-700 text-blue-400' : 'text-gray-200'
                      }`}
                    >
                      <span className="truncate">{song.name}</span>
                      {song.id === currentSongId && (
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-gray-600 mt-1 pt-1">
                    <button
                      onClick={handleCreateNewSong}
                      className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-gray-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      <span>+ New Song</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAddTrack}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Track
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{duration}s</span>
        </div>
      </div>

      {/* Timeline Content */}
      {!isCollapsed && (
        <div className="overflow-hidden" style={{ height: `${timelineHeight}px` }}>
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-sm mb-2">No tracks yet</p>
                <button
                  onClick={handleAddTrack}
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Add your first track
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Time Ruler */}
              <div className="flex border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-900">
                <div className="w-48 flex-shrink-0 border-r border-gray-700 dark:border-gray-600 px-2 py-1 text-xs text-gray-400 font-medium">
                  Time
                </div>
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden"
                >
                  <div className="relative h-6" style={{ width: `${contentWidth}px` }}>
                    {timeMarkers.map((time) => (
                      <div
                        key={time}
                        className="absolute top-0 bottom-0 flex flex-col"
                        style={{ left: `${time * PIXELS_PER_SECOND}px` }}
                      >
                        <div className="w-px h-2 bg-gray-600" />
                        <span className="text-[10px] text-gray-500 ml-1">
                          {time}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tracks - with vertical scrolling */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="relative">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex">
                      <Track
                        track={track}
                        pixelsPerSecond={PIXELS_PER_SECOND}
                        selectedSegmentId={selectedSegmentId}
                        playheadPosition={playheadPosition}
                        onSelectSegment={selectSegment}
                        onRemoveSegment={removeSegment}
                        onRemoveTrack={removeTrack}
                        onUpdateTrack={updateTrack}
                        onUpdateSegment={updateSegment}
                        onToggleMute={handleToggleMute}
                        onToggleSolo={handleToggleSolo}
                      />
                    </div>
                  ))}

                  {/* Playhead (overlays all tracks) */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: '192px' }} // Account for track header width
                  >
                    <Playhead
                      position={playheadPosition}
                      pixelsPerSecond={PIXELS_PER_SECOND}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
