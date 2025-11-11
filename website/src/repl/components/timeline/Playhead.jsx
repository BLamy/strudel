export function Playhead({ position, pixelsPerSecond }) {
  const left = position * pixelsPerSecond;

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
      style={{ left: `${left}px` }}
    >
      {/* Playhead Handle */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-sm" />
    </div>
  );
}
