import { Segment } from './Segment';

export function Track({
  track,
  pixelsPerSecond,
  selectedSegmentId,
  playheadPosition,
  onSelectSegment,
  onRemoveSegment,
  onRemoveTrack,
  onUpdateTrack,
  onUpdateSegment,
  onToggleMute,
  onToggleSolo,
}) {
  const handleTrackClick = (e) => {
    // Clear selection when clicking empty track area
    if (e.target === e.currentTarget || e.target.closest('.track-content')) {
      onSelectSegment(null);
    }
  };

  return (
    <div className="flex border-b border-gray-700 dark:border-gray-600">
      {/* Track Header */}
      <div className="w-48 flex-shrink-0 border-r border-gray-700 dark:border-gray-600 p-2 flex flex-col justify-between bg-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: track.color }}
          />
          <input
            type="text"
            value={track.name}
            onChange={(e) => onUpdateTrack(track.id, { name: e.target.value })}
            className="flex-1 min-w-0 bg-transparent text-sm text-white font-medium focus:outline-none focus:bg-gray-700 px-1 rounded truncate"
            placeholder="Track name"
            maxLength={20}
          />
        </div>

        <div className="flex items-center gap-1 mt-2">
          {/* Mute Button */}
          <button
            onClick={() => onToggleMute(track.id)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
              track.muted
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Mute track"
          >
            M
          </button>

          {/* Solo Button */}
          <button
            onClick={() => onToggleSolo(track.id)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
              track.solo
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Solo track"
          >
            S
          </button>

          {/* Remove Track Button */}
          <button
            onClick={() => onRemoveTrack(track.id)}
            className="ml-auto p-1 text-gray-400 hover:text-red-400 transition-colors"
            title="Remove track"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Track Content - Segments Area */}
      <div
        className="flex-1 relative h-16 bg-gray-900 dark:bg-gray-950 track-content"
        onClick={handleTrackClick}
      >
        {track.segments.map((segment) => (
          <Segment
            key={segment.id}
            segment={segment}
            trackId={track.id}
            trackColor={track.color}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={selectedSegmentId === segment.id}
            playheadPosition={playheadPosition}
            onSelect={onSelectSegment}
            onRemove={(segmentId) => onRemoveSegment(track.id, segmentId)}
            onUpdateSegment={onUpdateSegment}
          />
        ))}
      </div>
    </div>
  );
}
