import { useState, useCallback, useEffect } from 'react';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// LocalStorage keys
const STORAGE_KEYS = {
  CURRENT_SONG: 'strudel_timeline_current_song',
  SONGS_LIST: 'strudel_timeline_songs',
};

// Default track colors
const TRACK_COLORS = [
  '#ff6b6b', // red
  '#4ecdc4', // teal
  '#45b7d1', // blue
  '#f9ca24', // yellow
  '#6c5ce7', // purple
  '#fd79a8', // pink
  '#00b894', // green
  '#fdcb6e', // orange
];

export function useTimeline() {
  // Song management
  const [currentSongId, setCurrentSongId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_SONG) || 'default';
  });

  const [songs, setSongs] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SONGS_LIST);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      default: {
        id: 'default',
        name: 'Untitled Song',
        tracks: [],
        duration: 32,
        createdAt: Date.now(),
      },
    };
  });

  const currentSong = songs[currentSongId] || songs.default;

  const [tracks, setTracks] = useState(currentSong.tracks);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [duration, setDuration] = useState(currentSong.duration);
  const [isPlaying, setIsPlaying] = useState(false);

  // Save to localStorage whenever songs or current song changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SONGS_LIST, JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SONG, currentSongId);
  }, [currentSongId]);

  // Update current song when tracks or duration change
  useEffect(() => {
    setSongs((prev) => ({
      ...prev,
      [currentSongId]: {
        ...prev[currentSongId],
        tracks,
        duration,
        updatedAt: Date.now(),
      },
    }));
  }, [tracks, duration, currentSongId]);

  // Add a new track
  const addTrack = useCallback((name) => {
    const trackNumber = tracks.length + 1;
    const newTrack = {
      id: generateId(),
      name: name || `Track ${trackNumber}`,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      segments: [],
      muted: false,
      solo: false,
    };
    setTracks((prev) => [...prev, newTrack]);
    return newTrack.id;
  }, [tracks.length]);

  // Remove a track
  const removeTrack = useCallback((trackId) => {
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
    // Clear selection if it was on this track
    setSelectedSegmentId((prev) => {
      const track = tracks.find((t) => t.id === trackId);
      if (track?.segments.some((s) => s.id === prev)) {
        return null;
      }
      return prev;
    });
  }, [tracks]);

  // Update track properties
  const updateTrack = useCallback((trackId, updates) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  }, []);

  // Add a segment to a track
  const addSegment = useCallback((trackId, segmentData) => {
    const segment = {
      id: generateId(),
      code: segmentData.code || '',
      startTime: segmentData.startTime || 0,
      duration: segmentData.duration || 8,
      name: segmentData.name || 'Untitled',
      ...segmentData,
    };

    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? { ...track, segments: [...track.segments, segment] }
          : track
      )
    );

    // Extend timeline duration if segment goes beyond current duration
    const segmentEnd = segment.startTime + segment.duration;
    if (segmentEnd > duration) {
      setDuration(Math.ceil(segmentEnd / 8) * 8); // Round up to nearest 8 seconds
    }

    return segment.id;
  }, [duration]);

  // Remove a segment
  const removeSegment = useCallback((trackId, segmentId) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              segments: track.segments.filter((s) => s.id !== segmentId),
            }
          : track
      )
    );
    if (selectedSegmentId === segmentId) {
      setSelectedSegmentId(null);
    }
  }, [selectedSegmentId]);

  // Update segment properties
  const updateSegment = useCallback((trackId, segmentId, updates) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              segments: track.segments.map((segment) =>
                segment.id === segmentId
                  ? { ...segment, ...updates }
                  : segment
              ),
            }
          : track
      )
    );

    // Update duration if segment end changed
    if (updates.startTime !== undefined || updates.duration !== undefined) {
      const track = tracks.find((t) => t.id === trackId);
      const segment = track?.segments.find((s) => s.id === segmentId);
      if (segment) {
        const newStartTime = updates.startTime ?? segment.startTime;
        const newDuration = updates.duration ?? segment.duration;
        const segmentEnd = newStartTime + newDuration;
        if (segmentEnd > duration) {
          setDuration(Math.ceil(segmentEnd / 8) * 8);
        }
      }
    }
  }, [tracks, duration]);

  // Get active segments at a given time position
  const getActiveSegments = useCallback((time) => {
    const activeSegments = [];

    tracks.forEach((track) => {
      // Skip muted tracks
      if (track.muted) return;

      // Check if any track is soloed
      const hasSolo = tracks.some((t) => t.solo);
      if (hasSolo && !track.solo) return;

      track.segments.forEach((segment) => {
        if (
          time >= segment.startTime &&
          time < segment.startTime + segment.duration
        ) {
          activeSegments.push({
            ...segment,
            trackId: track.id,
            trackColor: track.color,
          });
        }
      });
    });

    return activeSegments;
  }, [tracks]);

  // Generate combined code from active segments
  const generateCombinedCode = useCallback((time) => {
    const activeSegments = getActiveSegments(time);

    if (activeSegments.length === 0) {
      return 'silence';
    }

    // Wrap each segment's code with .analyze() to enable waveform visualization
    const wrapWithAnalyze = (segment) => {
      const code = segment.code.trim();
      if (!code || code === 'silence') return code;
      // Wrap the code in parentheses and add .analyze(segmentId)
      return `(${code}).analyze("${segment.id}")`;
    };

    if (activeSegments.length === 1) {
      return wrapWithAnalyze(activeSegments[0]);
    }

    // Multiple segments - use stack() with proper formatting
    // Wrap each segment's code with analyze and ensure proper comma separation
    const segmentCodes = activeSegments
      .map((seg) => wrapWithAnalyze(seg))
      .filter((code) => code && code !== 'silence'); // Filter out empty or silence

    if (segmentCodes.length === 0) {
      return 'silence';
    }

    if (segmentCodes.length === 1) {
      return segmentCodes[0];
    }

    return `stack(\n  ${segmentCodes.join(',\n  ')}\n)`;
  }, [getActiveSegments]);

  // Get selected segment data
  const getSelectedSegment = useCallback(() => {
    if (!selectedSegmentId) return null;

    for (const track of tracks) {
      const segment = track.segments.find((s) => s.id === selectedSegmentId);
      if (segment) {
        return {
          ...segment,
          trackId: track.id,
          trackName: track.name,
        };
      }
    }
    return null;
  }, [selectedSegmentId, tracks]);

  // Select a segment
  const selectSegment = useCallback((segmentId) => {
    setSelectedSegmentId(segmentId);
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedSegmentId(null);
  }, []);

  // Song management functions
  const createNewSong = useCallback((name, switchToNew = false) => {
    const newSongId = generateId();
    const newSong = {
      id: newSongId,
      name: name || `Song ${Object.keys(songs).length + 1}`,
      tracks: [],
      duration: 32,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSongs((prev) => ({
      ...prev,
      [newSongId]: newSong,
    }));

    // If switchToNew is true, immediately switch to the new song
    if (switchToNew) {
      setCurrentSongId(newSongId);
      setTracks([]);
      setDuration(32);
      setSelectedSegmentId(null);
      setPlayheadPosition(0);
    }

    return newSongId;
  }, [songs]);

  const switchSong = useCallback((songId) => {
    const song = songs[songId];
    if (song) {
      setCurrentSongId(songId);
      setTracks(song.tracks);
      setDuration(song.duration);
      setSelectedSegmentId(null);
      setPlayheadPosition(0);
    }
  }, [songs]);

  const renameSong = useCallback((songId, newName) => {
    setSongs((prev) => ({
      ...prev,
      [songId]: {
        ...prev[songId],
        name: newName,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const deleteSong = useCallback((songId) => {
    if (songId === 'default') return; // Don't delete default song

    setSongs((prev) => {
      const updated = { ...prev };
      delete updated[songId];
      return updated;
    });

    // Switch to default if deleting current song
    if (songId === currentSongId) {
      switchSong('default');
    }
  }, [currentSongId, switchSong]);

  const getSongsList = useCallback(() => {
    return Object.values(songs).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [songs]);

  return {
    // State
    tracks,
    selectedSegmentId,
    playheadPosition,
    duration,
    isPlaying,
    currentSongId,
    currentSong,

    // Setters
    setPlayheadPosition,
    setIsPlaying,
    setDuration,

    // Track operations
    addTrack,
    removeTrack,
    updateTrack,

    // Segment operations
    addSegment,
    removeSegment,
    updateSegment,

    // Selection
    selectSegment,
    clearSelection,
    getSelectedSegment,

    // Playback
    getActiveSegments,
    generateCombinedCode,

    // Song management
    createNewSong,
    switchSong,
    renameSong,
    deleteSong,
    getSongsList,
  };
}
