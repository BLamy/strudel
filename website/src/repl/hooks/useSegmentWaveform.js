import { useEffect, useRef } from 'react';
import { getAnalyserById, getAnalyzerData } from '@strudel/webaudio';
import { getCachedWaveform, cacheWaveform } from './useWaveformCache';

/**
 * Hook for capturing and rendering a static waveform visualization
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {string|number} segmentId - Unique ID for this segment's analyser
 * @param {boolean} isPlaying - Whether this segment is currently playing
 * @param {string} color - Color for the waveform (CSS color string)
 * @param {object} options - Additional rendering options
 */
export function useSegmentWaveform(canvas, segmentId, isPlaying, color = '#ffffff', options = {}) {
  const analyserRef = useRef(null);
  const capturedDataRef = useRef(null);
  const captureFrameRef = useRef(0);
  const animationFrameRef = useRef(null);
  const hasLoadedCacheRef = useRef(false);

  const {
    fftSize = 2048,
    smoothingTimeConstant = 0.5,
    captureFrames = 60, // Number of frames to capture before rendering static waveform
  } = options;

  // Load cached waveform on mount
  useEffect(() => {
    if (!canvas || hasLoadedCacheRef.current) return;

    const cached = getCachedWaveform(segmentId);
    if (cached) {
      // Convert arrays back to Float32Arrays
      capturedDataRef.current = {
        maxValues: new Float32Array(cached.maxValues),
        minValues: new Float32Array(cached.minValues),
      };
      hasLoadedCacheRef.current = true;

      // Draw the cached waveform immediately
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawStaticWaveform(ctx, capturedDataRef.current, canvas.width, canvas.height, color);
      }
    }
  }, [canvas, segmentId, color]);

  useEffect(() => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If we already have captured data and not playing, just render the static waveform
    if (!isPlaying && capturedDataRef.current) {
      drawStaticWaveform(ctx, capturedDataRef.current, canvas.width, canvas.height, color);
      return;
    }

    // If not playing and no captured data, clear canvas
    if (!isPlaying) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Get or create analyser for this segment
    analyserRef.current = getAnalyserById(segmentId, fftSize, smoothingTimeConstant);

    // Reset capture on new playback
    if (captureFrameRef.current === 0) {
      capturedDataRef.current = null;
    }

    const captureAndDraw = () => {
      if (!analyserRef.current || !isPlaying) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      const dataArray = getAnalyzerData('time', segmentId);
      if (!dataArray) {
        animationFrameRef.current = requestAnimationFrame(captureAndDraw);
        return;
      }

      // Capture data for static rendering
      if (captureFrameRef.current < captureFrames) {
        if (!capturedDataRef.current) {
          capturedDataRef.current = {
            samples: new Float32Array(dataArray.length),
            maxValues: new Float32Array(Math.floor(canvas.width)),
            minValues: new Float32Array(Math.floor(canvas.width)),
          };
          capturedDataRef.current.maxValues.fill(-1);
          capturedDataRef.current.minValues.fill(1);
        }

        // Accumulate min/max values for each x position
        const samplesPerPixel = dataArray.length / canvas.width;
        for (let x = 0; x < canvas.width; x++) {
          const startSample = Math.floor(x * samplesPerPixel);
          const endSample = Math.floor((x + 1) * samplesPerPixel);

          for (let i = startSample; i < endSample && i < dataArray.length; i++) {
            const value = dataArray[i];
            capturedDataRef.current.maxValues[x] = Math.max(capturedDataRef.current.maxValues[x], value);
            capturedDataRef.current.minValues[x] = Math.min(capturedDataRef.current.minValues[x], value);
          }
        }

        captureFrameRef.current++;

        // Save to cache when capture is complete
        if (captureFrameRef.current >= captureFrames) {
          cacheWaveform(segmentId, capturedDataRef.current);
        }
      }

      // Draw the accumulated waveform
      if (capturedDataRef.current) {
        drawStaticWaveform(ctx, capturedDataRef.current, canvas.width, canvas.height, color);
      }

      animationFrameRef.current = requestAnimationFrame(captureAndDraw);
    };

    captureAndDraw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [canvas, segmentId, isPlaying, color, fftSize, smoothingTimeConstant, captureFrames]);

  // Reset capture when segment changes
  useEffect(() => {
    captureFrameRef.current = 0;
    capturedDataRef.current = null;
  }, [segmentId]);
}

/**
 * Draw a static waveform using min/max values
 */
function drawStaticWaveform(ctx, capturedData, width, height, color) {
  ctx.clearRect(0, 0, width, height);

  const { maxValues, minValues } = capturedData;
  const centerY = height / 2;
  const amplitude = height / 2;

  ctx.fillStyle = color;
  ctx.beginPath();

  // Draw the waveform as vertical bars (min to max for each x position)
  for (let x = 0; x < width && x < maxValues.length; x++) {
    const max = maxValues[x];
    const min = minValues[x];

    if (max === -1 && min === 1) continue; // No data captured yet

    const yMax = centerY - (max * amplitude * 0.8);
    const yMin = centerY - (min * amplitude * 0.8);
    const barHeight = Math.max(1, yMin - yMax);

    ctx.fillRect(x, yMax, 1, barHeight);
  }
}
