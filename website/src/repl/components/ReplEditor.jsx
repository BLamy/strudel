import { useState, useCallback, useRef, useEffect } from 'react';
import Loader from '@src/repl/components/Loader';
import { HorizontalPanel, VerticalPanel } from '@src/repl/components/panel/Panel';
import { Code } from '@src/repl/components/Code';
import UserFacingErrorMessage from '@src/repl/components/UserFacingErrorMessage';
import { Header } from './Header';
import { useSettings } from '@src/settings.mjs';
import { TimelinePanel } from './timeline/TimelinePanel';
import { useTimelinePlayback } from './timeline/useTimelinePlayback';
import { useTimeline } from '../hooks/useTimeline';

// type Props = {
//  context: replcontext,
// }

export default function ReplEditor(Props) {
  const { context, ...editorProps} = Props;
  const { containerRef, editorRef, error, init, pending, started } = context;
  const settings = useSettings();
  const { panelPosition, isZen } = settings;

  // Timeline state and functionality
  const timeline = useTimeline();
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const manualEditTimeoutRef = useRef(null);
  const lastEditorCodeRef = useRef('');

  // Timeline playback synchronization with manual edit detection
  useTimelinePlayback({
    timeline,
    editorRef,
    replStarted: started,
    isManualEditing,
  });

  // Set up code change listener for live editing
  useEffect(() => {
    if (!editorRef?.current?.repl) return;

    // Store reference to StrudelMirror's onUpdateState
    const originalOnUpdateState = editorRef.current.repl.onUpdateState;

    // Override to detect manual edits
    const handleCodeChange = (state) => {
      if (originalOnUpdateState) {
        originalOnUpdateState(state);
      }

      const currentCode = state.code || '';

      // Only track changes if a segment is selected
      if (selectedSegment) {
        // Detect if user is manually editing (code changed but not from timeline)
        if (currentCode !== lastEditorCodeRef.current) {
          // User is editing - pause timeline control
          setIsManualEditing(true);

          // Update the selected segment with new code
          timeline.updateSegment(selectedSegment.trackId, selectedSegment.id, { code: currentCode });

          // Clear existing timeout
          if (manualEditTimeoutRef.current) {
            clearTimeout(manualEditTimeoutRef.current);
          }

          // Resume timeline control after 2 seconds of no edits
          manualEditTimeoutRef.current = setTimeout(() => {
            setIsManualEditing(false);
          }, 2000);
        }
      }

      lastEditorCodeRef.current = currentCode;
    };

    editorRef.current.repl.onUpdateState = handleCodeChange;

    return () => {
      if (manualEditTimeoutRef.current) {
        clearTimeout(manualEditTimeoutRef.current);
      }
    };
  }, [editorRef, selectedSegment, timeline]);

  // Handle segment selection - update editor and notify AI
  const handleSegmentSelect = useCallback((segment) => {
    setSelectedSegment(segment);
    lastEditorCodeRef.current = segment?.code || '';
    if (segment && editorRef?.current) {
      // Focus the segment's code in the main editor
      editorRef.current.setCode(segment.code);
    }
  }, [editorRef]);

  // Enhanced context with timeline
  const enhancedContext = {
    ...context,
    timeline,
    selectedSegment,
  };

  return (
    <div className="h-full flex flex-col relative" {...editorProps}>
      <Loader active={pending} />
      <Header context={enhancedContext} />
      <div className="grow flex relative overflow-hidden">
        <Code containerRef={containerRef} editorRef={editorRef} init={init} />
        {!isZen && panelPosition === 'right' && <VerticalPanel context={enhancedContext} />}
      </div>
      <UserFacingErrorMessage error={error} />
      {!isZen && panelPosition === 'bottom' && <HorizontalPanel context={enhancedContext} />}
      {!isZen && (
        <TimelinePanel
          context={enhancedContext}
          onSegmentSelect={handleSegmentSelect}
        />
      )}
    </div>
  );
}
