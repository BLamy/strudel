import { useEffect, useRef } from 'react';
import { getAnalyserById, getAnalyzerData } from '@strudel/webaudio';
import { getCachedWaveform, cacheWaveform } from './useWaveformCache';

/**
 * Hook for rendering waveform visualization
 * - Shows cached static waveform if available
 * - Records and shows live oscilloscope on first play
 * - Caches the recorded waveform for future use
 */
export function useSegmentWaveform(canvas, segmentId, isPlaying, color = '#ffffff', options = {}) {
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const capturedDataRef = useRef(null);
  const hasLoadedCacheRef = useRef(false);
  const isRecordingRef = useRef(false);

  const {
    fftSize = 2048,
    smoothingTimeConstant = 0.8,
    lineWidth = 1.5,
    scale = 0.8,
  } = options;

  // Load cached waveform on mount
  useEffect(() => {
    if (!canvas || hasLoadedCacheRef.current) return;

    const cached = getCachedWaveform(segmentId);
    console.log('Loading cache for segment:', segmentId, cached);
    if (cached && cached.maxValues && cached.minValues) {
      capturedDataRef.current = cached;
      hasLoadedCacheRef.current = true;

      // Draw the cached static waveform
      const ctx = canvas.getContext('2d');
      if (ctx) {
        console.log('Drawing cached waveform:', cached);
        drawStaticWaveform(ctx, cached, canvas.width, canvas.height, color);
      }
    }
  }, [canvas, segmentId, color]);

  useEffect(() => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If we have cached data, always show it
    if (capturedDataRef.current) {
      drawStaticWaveform(ctx, capturedDataRef.current, canvas.width, canvas.height, color);

      // If not playing, we're done - just show the cached waveform
      if (!isPlaying) {
        // Clean up animation frame if any
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      // If playing but we already have cached data, don't re-record
      return;
    }

    // If not playing and no cached data, clear canvas
    if (!isPlaying) {
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Start recording - this is the first time playing
    console.log('Starting recording for segment:', segmentId);
    isRecordingRef.current = true;
    capturedDataRef.current = {
      samples: [],
    };

    // Get or create analyser
    analyserRef.current = getAnalyserById(segmentId, fftSize, smoothingTimeConstant);
    console.log('Analyser created/retrieved:', analyserRef.current ? 'success' : 'failed');

    const draw = () => {
      if (!analyserRef.current || !isPlaying) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // When playback stops, finalize and cache the waveform
        if (isRecordingRef.current && capturedDataRef.current && capturedDataRef.current.samples.length > 0) {
          isRecordingRef.current = false;

          // Convert captured samples to static waveform data
          const staticWaveform = convertToStaticWaveform(capturedDataRef.current.samples, canvas.width);
          console.log('Converted to static waveform:', {
            segmentId,
            maxLength: staticWaveform.maxValues.length,
            minLength: staticWaveform.minValues.length,
            sampleMax: Math.max(...staticWaveform.maxValues),
            sampleMin: Math.min(...staticWaveform.minValues)
          });
          capturedDataRef.current = staticWaveform;

          // Cache it (cacheWaveform already adds timestamp)
          console.log('Caching waveform for segment:', segmentId);
          cacheWaveform(segmentId, staticWaveform);

          // Draw the final static waveform
          drawStaticWaveform(ctx, staticWaveform, canvas.width, canvas.height, color);
        }
        return;
      }

      // Get time-domain data
      const dataArray = getAnalyzerData('time', segmentId);

      if (!dataArray) {
        if (isRecordingRef.current && capturedDataRef.current.samples.length === 0) {
          console.log('No analyzer data available yet for segment:', segmentId);
        }
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Record this frame's data
      if (isRecordingRef.current) {
        const sampleCopy = new Float32Array(dataArray);
        capturedDataRef.current.samples.push(sampleCopy);

        // Log first few samples to verify we're getting data
        if (capturedDataRef.current.samples.length % 30 === 0) {
          console.log('Recording frame', capturedDataRef.current.samples.length, '- sample values:',
            Array.from(sampleCopy.slice(0, 10)));
        }
      }

      const bufferLength = analyserRef.current.frequencyBinCount;

      // Draw live oscilloscope while recording
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      const centerY = canvas.height / 2;
      const amplitude = (canvas.height / 2) * scale;

      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i];
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
        animationFrameRef.current = null;
      }

      // When playback stops (cleanup), finalize and cache the waveform
      if (isRecordingRef.current && capturedDataRef.current && capturedDataRef.current.samples && capturedDataRef.current.samples.length > 0) {
        console.log('Finalizing recording in cleanup. Frames captured:', capturedDataRef.current.samples.length);
        isRecordingRef.current = false;

        // Convert captured samples to static waveform data
        const staticWaveform = convertToStaticWaveform(capturedDataRef.current.samples, canvas.width);
        console.log('Converted to static waveform:', {
          segmentId,
          maxLength: staticWaveform.maxValues.length,
          minLength: staticWaveform.minValues.length,
          sampleMax: Math.max(...staticWaveform.maxValues),
          sampleMin: Math.min(...staticWaveform.minValues)
        });
        capturedDataRef.current = staticWaveform;

        // Cache it (cacheWaveform already adds timestamp)
        console.log('Caching waveform for segment:', segmentId);
        cacheWaveform(segmentId, staticWaveform);

        // Draw the final static waveform
        if (ctx) {
          drawStaticWaveform(ctx, staticWaveform, canvas.width, canvas.height, color);
        }
      }
    };
  }, [canvas, segmentId, isPlaying, color, fftSize, smoothingTimeConstant, lineWidth, scale]);
}

/**
 * Convert recorded samples to static waveform data (like an audio editor)
 */
function convertToStaticWaveform(samples, canvasWidth) {
  if (!samples || samples.length === 0) {
    return { maxValues: [], minValues: [] };
  }

  const maxValues = new Array(canvasWidth).fill(-1);
  const minValues = new Array(canvasWidth).fill(1);

  // Total number of audio samples across all frames
  const totalSamples = samples.length * samples[0].length;
  const samplesPerPixel = totalSamples / canvasWidth;

  let currentSampleIndex = 0;

  for (let x = 0; x < canvasWidth; x++) {
    const startSample = Math.floor(x * samplesPerPixel);
    const endSample = Math.floor((x + 1) * samplesPerPixel);

    // Find min/max across all samples for this pixel
    for (let sampleIdx = startSample; sampleIdx < endSample && sampleIdx < totalSamples; sampleIdx++) {
      const frameIndex = Math.floor(sampleIdx / samples[0].length);
      const sampleInFrame = sampleIdx % samples[0].length;

      if (frameIndex < samples.length) {
        const value = samples[frameIndex][sampleInFrame];
        maxValues[x] = Math.max(maxValues[x], value);
        minValues[x] = Math.min(minValues[x], value);
      }
    }
  }

  return { maxValues, minValues };
}

/**
 * Draw static waveform (like audio editor visualization)
 */
function drawStaticWaveform(ctx, waveformData, width, height, color) {
  ctx.clearRect(0, 0, width, height);

  if (!waveformData || !waveformData.maxValues || !waveformData.minValues) {
    return;
  }

  const { maxValues, minValues } = waveformData;
  const centerY = height / 2;
  const amplitude = height / 2;

  ctx.fillStyle = color;

  for (let x = 0; x < maxValues.length && x < width; x++) {
    const max = maxValues[x];
    const min = minValues[x];

    if (max === -1 && min === 1) continue; // No data

    const yMax = centerY - (max * amplitude * 0.8);
    const yMin = centerY - (min * amplitude * 0.8);
    const barHeight = Math.max(1, yMin - yMax);

    ctx.fillRect(x, yMax, 1, barHeight);
  }
}
