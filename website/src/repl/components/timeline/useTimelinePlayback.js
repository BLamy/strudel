import { useEffect, useRef, useCallback } from 'react';
import { getAudioContext } from '@strudel/webaudio';

export function useTimelinePlayback({ timeline, editorRef, replStarted }) {
  const lastActiveCodeRef = useRef('');
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);

  const {
    playheadPosition,
    setPlayheadPosition,
    setIsPlaying,
    generateCombinedCode,
  } = timeline;

  // Check if timeline has any segments
  const hasSegments = timeline.tracks?.some(track => track.segments?.length > 0);

  // Update playhead position and evaluate code
  const updatePlayback = useCallback(() => {
    if (!replStarted || !editorRef?.current) {
      return;
    }

    try {
      const audioContext = getAudioContext();
      const currentTime = audioContext.currentTime;

      // Initialize start time on first run
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      // Calculate playhead position relative to timeline start
      const timelinePosition = currentTime - startTimeRef.current;
      setPlayheadPosition(timelinePosition);

      // Only control editor if timeline has segments
      if (hasSegments) {
        // Generate code for current position
        const activeCode = generateCombinedCode(timelinePosition);

        // Only update if code has changed
        if (activeCode !== lastActiveCodeRef.current) {
          lastActiveCodeRef.current = activeCode;

          // Set code in editor
          editorRef.current.setCode(activeCode);

          // Evaluate the new code
          if (editorRef.current.evaluate) {
            editorRef.current.evaluate();
          }
        }
      }
    } catch (error) {
      console.error('Timeline playback error:', error);
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updatePlayback);
  }, [
    replStarted,
    editorRef,
    setPlayheadPosition,
    generateCombinedCode,
    hasSegments,
  ]);

  // Start/stop playback loop
  useEffect(() => {
    if (replStarted) {
      setIsPlaying(true);
      startTimeRef.current = null; // Reset start time
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
    } else {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Reset playhead when stopped
      setPlayheadPosition(0);
      startTimeRef.current = null;
      lastActiveCodeRef.current = '';
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [replStarted, setIsPlaying, setPlayheadPosition, updatePlayback]);

  return {
    playheadPosition,
  };
}
