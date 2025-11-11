import { useEffect, useRef } from 'react';
import { getAnalyserById, getAnalyzerData } from '@strudel/webaudio';

/**
 * Hook for rendering real-time waveform visualization on a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {string|number} segmentId - Unique ID for this segment's analyser
 * @param {boolean} isPlaying - Whether this segment is currently playing
 * @param {string} color - Color for the waveform (CSS color string)
 * @param {object} options - Additional rendering options
 */
export function useSegmentWaveform(canvas, segmentId, isPlaying, color = '#ffffff', options = {}) {
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);

  const {
    fftSize = 2048, // Must be power of 2 between 32 and 32768
    smoothingTimeConstant = 0.8,
    lineWidth = 1.5,
    scale = 0.8, // How much of the canvas height to use
  } = options;

  useEffect(() => {
    if (!canvas || !isPlaying) {
      // Clean up animation frame if not playing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clear canvas when not playing
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      return;
    }

    // Get or create analyser for this segment
    analyserRef.current = getAnalyserById(segmentId, fftSize, smoothingTimeConstant);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Get time-domain data
      const dataArray = getAnalyzerData('time', segmentId);

      if (!dataArray) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const bufferLength = analyserRef.current.frequencyBinCount;

      // Clear canvas with slight transparency for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set up drawing style
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      const centerY = canvas.height / 2;
      const amplitude = (canvas.height / 2) * scale;

      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i]; // Value is between -1 and 1
        const y = centerY + (v * amplitude);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Start animation loop
    draw();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvas, segmentId, isPlaying, color, fftSize, smoothingTimeConstant, lineWidth, scale]);
}
