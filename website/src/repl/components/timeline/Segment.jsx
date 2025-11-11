import { useRef, useState, useEffect } from 'react';

export function Segment({
  segment,
  trackColor,
  pixelsPerSecond,
  isSelected,
  onSelect,
  onRemove,
  onUpdateSegment,
  trackId,
}) {
  const segmentRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, startTime: 0, duration: 0 });

  const left = segment.startTime * pixelsPerSecond;
  const width = segment.duration * pixelsPerSecond;

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
      {/* Left resize handle */}
      {isSelected && (
        <div
          className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-20 hover:bg-opacity-40 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
          title="Resize segment"
        />
      )}

      <div className="h-full flex items-center justify-between px-2 overflow-hidden pointer-events-none">
        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-semibold text-white truncate">
            {segment.name}
          </div>
          <div className="text-[10px] text-white text-opacity-75 truncate">
            {segment.duration.toFixed(1)}s
          </div>
        </div>

        {isSelected && (
          <button
            onClick={handleRemove}
            className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center transition-colors pointer-events-auto"
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
        )}
      </div>

      {/* Right resize handle */}
      {isSelected && (
        <div
          className="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white bg-opacity-20 hover:bg-opacity-40 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
          title="Resize segment"
        />
      )}
    </div>
  );
}
