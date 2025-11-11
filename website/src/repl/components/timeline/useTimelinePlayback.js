import { useEffect, useRef, useCallback } from 'react';
import { getAudioContext } from '@strudel/webaudio';

export function useTimelinePlayback({ timeline, editorRef, replStarted, isManualEditing }) {
  const lastActiveCodeRef = useRef('');
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const hasSegmentsRef = useRef(false);

  const {
    playheadPosition,
    setPlayheadPosition,
    setIsPlaying,
    generateCombinedCode,
    getSelectedSegment,
  } = timeline;

  // Check if timeline has any segments
  const hasSegments = timeline.tracks?.some(track => track.segments?.length > 0);
  hasSegmentsRef.current = hasSegments;

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
      let timelinePosition = currentTime - startTimeRef.current;

      // Check if selected segment has repeat mode enabled
      const selectedSegment = getSelectedSegment();
      const isRepeatMode = selectedSegment?.repeat || false;

      // If in repeat mode, loop the selected segment
      if (isRepeatMode && selectedSegment) {
        const segmentDuration = selectedSegment.duration;
        const segmentStart = selectedSegment.startTime;

        // Calculate position within the repeated segment
        const relativePosition = (timelinePosition - segmentStart) % segmentDuration;
        timelinePosition = segmentStart + (relativePosition >= 0 ? relativePosition : segmentDuration + relativePosition);
      }

      setPlayheadPosition(timelinePosition);

      // Only control editor if timeline has segments AND user is not manually editing
      if (hasSegmentsRef.current && !isManualEditing) {
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
    getSelectedSegment,
    isManualEditing,
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
