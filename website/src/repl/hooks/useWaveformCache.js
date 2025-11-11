// LocalStorage key for waveform cache
const WAVEFORM_CACHE_KEY = 'strudel_segment_waveforms';

// Maximum number of waveforms to cache (to avoid storage limits)
const MAX_CACHED_WAVEFORMS = 100;

/**
 * Get cached waveform data for a segment
 * @param {string} segmentId - Segment ID
 * @returns {object|null} - Cached waveform data or null
 */
export function getCachedWaveform(segmentId) {
  try {
    const cache = localStorage.getItem(WAVEFORM_CACHE_KEY);
    if (!cache) return null;

    const waveforms = JSON.parse(cache);
    return waveforms[segmentId] || null;
  } catch (error) {
    console.error('Failed to get cached waveform:', error);
    return null;
  }
}

/**
 * Save waveform data to cache
 * @param {string} segmentId - Segment ID
 * @param {object} waveformData - Waveform data with maxValues and minValues
 */
export function cacheWaveform(segmentId, waveformData) {
  try {
    const cache = localStorage.getItem(WAVEFORM_CACHE_KEY);
    const waveforms = cache ? JSON.parse(cache) : {};

    // Convert Float32Arrays to regular arrays for JSON serialization
    waveforms[segmentId] = {
      maxValues: Array.from(waveformData.maxValues),
      minValues: Array.from(waveformData.minValues),
      timestamp: Date.now(),
    };

    // Limit cache size by removing oldest entries
    const entries = Object.entries(waveforms);
    if (entries.length > MAX_CACHED_WAVEFORMS) {
      // Sort by timestamp and keep only the most recent
      entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      const limitedWaveforms = Object.fromEntries(entries.slice(0, MAX_CACHED_WAVEFORMS));
      localStorage.setItem(WAVEFORM_CACHE_KEY, JSON.stringify(limitedWaveforms));
    } else {
      localStorage.setItem(WAVEFORM_CACHE_KEY, JSON.stringify(waveforms));
    }
  } catch (error) {
    console.error('Failed to cache waveform:', error);
  }
}

/**
 * Clear cached waveform for a segment
 * @param {string} segmentId - Segment ID
 */
export function clearCachedWaveform(segmentId) {
  try {
    const cache = localStorage.getItem(WAVEFORM_CACHE_KEY);
    if (!cache) return;

    const waveforms = JSON.parse(cache);
    delete waveforms[segmentId];
    localStorage.setItem(WAVEFORM_CACHE_KEY, JSON.stringify(waveforms));
  } catch (error) {
    console.error('Failed to clear cached waveform:', error);
  }
}

/**
 * Clear all cached waveforms
 */
export function clearAllCachedWaveforms() {
  try {
    localStorage.removeItem(WAVEFORM_CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear waveform cache:', error);
  }
}
