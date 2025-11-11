import { useRef, useState, useEffect } from 'react';
import { useSegmentWaveform } from '../../hooks/useSegmentWaveform';

export function Segment({
  segment,
  trackColor,
  pixelsPerSecond,
  isSelected,
  playheadPosition,
  onSelect,
  onRemove,
  onUpdateSegment,
  trackId,
}) {
  const segmentRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0 });

  const left = segment.startTime * pixelsPerSecond;
  const width = segment.duration * pixelsPerSecond;

  // Determine if this segment is currently playing
  const isPlaying =
    playheadPosition >= segment.startTime &&
    playheadPosition < segment.startTime + segment.duration;

  // Use waveform visualization hook
  useSegmentWaveform(
    canvasRef.current,
    segment.id,
    isPlaying,
    trackColor,
    {
      fftSize: 2048, // Must be power of 2 between 32 and 32768
      smoothingTimeConstant: 0.8,
      lineWidth: 1.5,
      scale: 0.7,
    }
  );

  const handleClick = (e) => {
    if (!isDragging && !isResizing) {
      e.stopPropagation();
      onSelect(segment.id);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(segment.id);
  };

  const handleToggleRepeat = (e) => {
    e.stopPropagation();
    onUpdateSegment(trackId, segment.id, { repeat: !segment.repeat });
  };

  // Drag to reposition
  const handleMouseDown = (e) => {
    if (e.target.closest('.resize-handle')) return; // Don't drag when resizing
    e.stopPropagation();
    onSelect(segment.id);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      startTime: segment.startTime,
      duration: segment.duration,
    };
  };

  // Resize handles
  const handleResizeStart = (e, side) => {
    e.stopPropagation();
    onSelect(segment.id);
    setIsResizing(true);
    dragStartRef.current = {
      x: e.clientX,
      startTime: segment.startTime,
      duration: segment.duration,
      side,
    };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStartTime = Math.max(0, dragStartRef.current.startTime + deltaTime);

      onUpdateSegment(trackId, segment.id, { startTime: newStartTime });
    } else if (isResizing) {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaTime = deltaX / pixelsPerSecond;

      if (dragStartRef.current.side === 'left') {
        // Resize from left - change startTime and duration
        const newStartTime = Math.max(0, dragStartRef.current.startTime + deltaTime);
        const newDuration = dragStartRef.current.duration - (newStartTime - dragStartRef.current.startTime);

        if (newDuration >= 1) { // Minimum 1 second
          onUpdateSegment(trackId, segment.id, {
            startTime: newStartTime,
            duration: newDuration,
          });
        }
      } else {
        // Resize from right - only change duration
        const newDuration = Math.max(1, dragStartRef.current.duration + deltaTime);
        onUpdateSegment(trackId, segment.id, { duration: newDuration });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Add global mouse event listeners when dragging/resizing
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={segmentRef}
      className={`absolute top-1 bottom-1 rounded ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } transition-shadow ${
        isSelected
          ? 'ring-2 ring-white ring-opacity-75 z-10'
          : 'hover:ring-1 hover:ring-white hover:ring-opacity-50'
      }`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: trackColor,
        opacity: isSelected ? 1 : 0.85,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title={`${segment.name} (${segment.duration}s)`}
    >
      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-40"
        width={Math.max(width, 10)}
        height={60}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Left resize handle */}
      {isSelected && (
        <div
          className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-20 hover:bg-opacity-40 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
          title="Resize segment"
        />
      )}

      <div className="h-full flex items-center justify-between px-2 overflow-hidden pointer-events-none relative z-10">
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
            {segment.name}
            {segment.repeat && (
              <svg className="w-3 h-3 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="text-[10px] text-white text-opacity-75 truncate">
            {segment.duration.toFixed(1)}s
          </div>
        </div>

        {isSelected && (
          <div className="flex items-center gap-1 ml-2 flex-shrink-0 pointer-events-auto">
            <button
              onClick={handleToggleRepeat}
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                segment.repeat
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-white bg-opacity-20 hover:bg-opacity-30'
              }`}
              title={segment.repeat ? 'Disable repeat mode' : 'Enable repeat mode'}
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleRemove}
              className="w-5 h-5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition-colors"
              title="Remove segment"
            >
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Right resize handle */}
      {isSelected && (
        <div
          className="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-20 hover:bg-opacity-40 transition-colors z-10"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
          title="Resize segment"
        />
      )}
    </div>
  );
}
