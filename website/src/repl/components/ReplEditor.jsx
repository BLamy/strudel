import { useState, useCallback } from 'react';
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

  // Timeline playback synchronization
  useTimelinePlayback({
    timeline,
    editorRef,
    replStarted: started,
  });

  // Handle segment selection - update editor and notify AI
  const handleSegmentSelect = useCallback((segment) => {
    setSelectedSegment(segment);
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
