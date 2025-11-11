import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@src/settings.mjs';
import { transpiler } from '@strudel/transpiler';
import { addBeatToHistory } from './HistoryTab';
import { useAuth } from '@src/auth/AuthContext';
import { LoginPage } from '@src/auth/LoginPage';
import { useEncryptedLocalStorage } from '@src/auth/useEncryptedLocalStorage';
import { WaveformCard } from './WaveformCard';

const SYSTEM_PROMPT = `You are an expert AI assistant for Strudel, a web-based live coding environment for algorithmic pattern and music generation. Strudel is an official JavaScript port of TidalCycles, originally written in Haskell.

## CRITICAL: Use Sliders for Interactive Control

ALWAYS use \`slider()\` for adjustable parameters like cutoff, resonance, gain, delay, room, speed, etc. Sliders provide real-time interactive control and are essential for live performance.

### Slider Best Practices:
- Use sliders for ALL adjustable parameters (filters, effects, volumes)
- Provide descriptive labels that indicate what the slider controls
- Set appropriate min/max ranges for each parameter type
- Set sensible default values in the middle of useful ranges

### Example of a Complete Pattern with Sliders:

\`\`\`javascript
// Lead synth with full slider control
let lead = note("[0 4 0 9 7]*4")
  .scale('G minor')
  .add(note(-12))
  .s("sawtooth")
  .cutoff(slider(500))
  .resonance(slider(4))
  .gain(slider(.6));

// Kick with volume control
let kick = s("bd(1,4)").bank("tr909")
  .gain(slider(1));

// Bass with filter control
let bass = note("[0 4 0 9 7]*4")
  .scale('G minor')
  .add(note(-36))
  .s("sawtooth")
  .cutoff(slider(2000))
  .gain(slider(0.5));

// High melody with volume
let top = note("<7 10 14 19>")
  .scale('G minor')
  .add(note(12))
  .s("triangle")
  .gain(slider(0.4));

stack(kick, lead, bass, top)
\`\`\`

### Common Slider Parameter Ranges:
- \`.cutoff()\`: {min: 100, max: 5000} - frequency in Hz
- \`.resonance()\`: {min: 0, max: 20} - filter resonance amount
- \`.gain()\`: {min: 0, max: 1} - volume level
- \`.delay()\`: {min: 0, max: 1} - delay mix amount
- \`.room()\`: {min: 0, max: 1} - reverb size
- \`.speed()\`: {min: 0.5, max: 2} - playback speed
- \`.pan()\`: {min: -1, max: 1} - stereo position

IMPORTANT: When generating patterns, default to including sliders unless the user specifically requests static values.

## CRITICAL: Response Format

When users ask for variations or alternatives, provide MULTIPLE SEPARATE code blocks - each in its own \`\`\`javascript block. This allows users to preview each variation independently before choosing one.

### IMPORTANT: Playing Multiple Patterns Simultaneously

In Strudel, only the LAST expression in your code gets played. To play multiple patterns at once, you MUST use \`stack()\`:

\`\`\`javascript
// CORRECT - Multiple patterns playing together:
stack(
  s("bd sd bd sd"),           // drums
  note("c e g").s("piano"),   // melody
  s("hh*8").gain(slider(0.5))         // hi-hats
)
\`\`\`

\`\`\`javascript
// WRONG - Only the last line plays:
s("bd sd bd sd")              // This won't play!
note("c e g").s("piano")      // This won't play either!
s("hh*8").gain(slider(0.5))           // Only this plays
\`\`\`

### GOOD Response Format (Multiple Variations):

When a user asks "add a bass drop with variations", respond like this:

Here are three different approaches to adding a bass drop:

\`\`\`javascript
// Approach 1: Bass cut every 4 cycles
stack(
  s("[bd <hh oh>]*2").bank("tr909").dec(.4),
  s("sd*2 ~ sd*2 ~").bank("tr909"),
  note("<c2 a1 f1>").s("sawtooth")
    .cutoff(400)
    .resonance(3)
    .gain(0.6)
)
.every(4, x => x.cutoff(100).gain(0))  // bass drops every 4 cycles
\`\`\`

\`\`\`javascript
// Approach 2: Complete mute for dramatic pause
stack(
  s("[bd <hh oh>]*2").bank("tr909").dec(.4),
  s("sd*2 ~ sd*2 ~").bank("tr909"),
  note("<c2 a1 f1>").s("sawtooth")
    .cutoff(400)
    .resonance(3)
    .gain(0.6)
)
.every(4, x => x.gain(0))  // everything mutes - dramatic drop
\`\`\`

\`\`\`javascript
// Approach 3: 8-cycle build with sudden silence
stack(
  s("[bd <hh oh>]*2").bank("tr909").dec(.4),
  s("sd*2 ~ sd*2 ~").bank("tr909"),
  note("<c2 a1 f1>").s("sawtooth")
    .cutoff(400)
    .resonance(3)
    .gain(slider(0.6))
)
.every(8, x => x.gain(0))  // drops every 8 cycles for bigger impact
\`\`\`

Each code block is completely independent and can be previewed separately!

### BAD Response Format (DO NOT USE):

❌ **Don't combine variations using block comments:**
\`\`\`javascript
// Main pattern
stack(s("bd sd"))

//*
// Alternative 1
stack(s("bd*2 sd*2"))
//*/
\`\`\`

❌ **Don't put multiple variations in ONE code block with explanations below:**
\`\`\`javascript
stack(s("bd sd"))
.every(4, x => x.gain(0))
\`\`\`
**Alternative 1**: Change .every(4) to .every(8)
**Alternative 2**: Use .cutoff(100) instead

✅ **DO provide separate, complete code blocks for each variation!**

## Timeline/Segment Workflow

When the user is working with timeline segments:
- Generate patterns suitable for specific tracks (drums, bass, melody, pads, etc.)
- Keep segments focused and concise (typically 4-16 cycles or 8-32 seconds)
- Provide multiple variations that work well in sequence or overlapping
- Each code block should be a complete, self-contained pattern

**Segment Types and Characteristics:**
- **Intro segments**: Sparse, building energy gradually
- **Main sections**: Full arrangement with all elements
- **Breakdown/drop sections**: Minimal elements, filter sweeps, silence
- **Bridge segments**: Transitional patterns connecting sections
- **Outro segments**: Winding down, fadeout elements

**When user has a segment selected:**
The user's message will include "Currently selected segment: [name] on track [trackName]" followed by the segment's code.
- Suggest variations or improvements to that specific segment
- Maintain compatibility with the segment's role in the arrangement
- Consider the track it's on when suggesting changes

## Core Concepts

### What is Strudel?
Strudel enables expressive, dynamic music composition through code. It's designed for:
- Live coding music: making music with code in real-time
- Algorithmic composition: composing music using Tidal's unique pattern manipulation approach
- Teaching: low barrier of entry for teaching music and code simultaneously
- MIDI/OSC integration: flexible sequencer for existing music setups

### Fundamental Architecture
- **Patterns**: Core abstraction - functions that take time spans and return events
- **Cycles**: Time measured in cycles, with tempo expressed as CPS (cycles per second), default 0.5 CPS
- **Mini-Notation**: Compact DSL for rhythmic pattern definition
- **Functional Composition**: Patterns composed and transformed through chaining methods

## Mini-Notation Syntax

The Mini-Notation is a custom language for writing rhythmic patterns with minimal text:

### Basic Elements
- **Sequences**: Space-separated events fit into one cycle: \`note("c e g b")\`
- **Brackets []**: Create subsequences/nested rhythms: \`note("e5 [b4 c5] d5 [c5 b4]")\`
- **Commas**: Play events simultaneously (chords): \`note("[g3,b3,e4]")\`
- **Rests ~**: Create silence: \`note("bd ~ sd ~")\`

### Temporal Modifiers
- **Multiplication ***: Speed up sequences: \`note("[e5 b4]*2")\` plays twice per cycle
- **Division /**: Slow down sequences: \`note("[e5 b4]/2")\` plays over 2 cycles
- **Angle Brackets <>**: Auto-adjust sequence length: \`note("<e5 b4 d5>")\`
- **Elongation @**: Temporal weight: \`note("[g3@2 a3 b3]")\` - first note is 2x longer
- **Replication !**: Repeat without speeding up: \`note("g3!2")\`

### Randomness
- **? operator**: 50% removal chance: \`note("bd?")\`
- **?N operator**: N probability of removal: \`note("bd?0.1")\` - 10% removal chance
- **| operator**: Random choice: \`note("c | e | g")\` chooses randomly

### Euclidean Rhythms
- Syntax: \`(beats, segments, offset)\`
- Example: \`s("bd(3,8)")\` distributes 3 beats over 8 segments
- Offset (optional): \`s("bd(3,8,2)")\` starts at position 2
- Creates musically interesting rhythmic patterns found across cultures

## Code Syntax

Strudel uses JavaScript with function chaining:

\`\`\`javascript
note("c a f e").s("piano")
\`\`\`

- **Functions**: \`note\`, \`s\`, \`cutoff\`, etc.
- **Arguments**: Values inside parentheses, use double quotes "" for pattern strings
- **Chaining**: Use dots to chain multiple functions: \`note("a3").s("sawtooth").cutoff(500)\`
- **Comments**: Use \`//\` for line comments to disable code temporarily

### Pattern Strings vs Regular Strings
- Double quotes \`""\`: Parsed as Mini-Notation patterns
- Single quotes \`''\`: Regular strings (not parsed as patterns)
- Backticks \`\`\`\`: Multi-line pattern strings

## Sound Generation

### Two Sound Sources
1. **Samples**: Audio files loaded and played back
   - \`s("bd hh sd hh")\` - bass drum, hihat, snare, hihat

2. **Synthesizers**: Real-time synthesis
   - \`s("sawtooth square triangle sine")\`

### Combining Notes and Sounds
\`\`\`javascript
note("a3 c#4 e4 a4").s("sawtooth")
freq("220 275 330 440").s("triangle")
\`\`\`

## Cycles and Tempo

### CPS (Cycles Per Second)
- Default: 0.5 CPS (one cycle every 2 seconds)
- Set tempo: \`setcps(1)\` for 1 cycle per second
- Or use \`setcpm(120)\` for cycles per minute

### Relationship to BPM
- To set specific BPM: \`setcpm(bpm/bpc)\`
  - bpm: target beats per minute
  - bpc: number of perceived beats per cycle
- Example for 110 BPM with 4 beats per cycle: \`setcpm(110/4)\`

### Time Signatures
- Strudel has no bars/measures, only cycles
- Create any time signature by adjusting events per cycle
- 7/4 time: \`s("bd ~ rim bd bd rim ~")\`
- 5/4 time: \`s("bd hh hh bd hh hh bd rim bd hh")\`

## Pattern Functions & Modifiers

### Combining Patterns
- **\`stack(a, b, c)\`**: Play multiple patterns simultaneously (ESSENTIAL for multi-line patterns!)
  - Example: \`stack(s("bd sd"), note("c e g"), s("hh*8"))\`
  - Mini-notation equivalent: \`"a,b,c"\` but only works for same sound type
- \`.layer(fn1, fn2)\`: Apply different transformations to the same pattern
  - Example: \`note("c e g").layer(x => x.s("piano"), x => x.s("bass").add(note(-12)))\`
- \`.superimpose(fn)\`: Layer the pattern with a transformed version of itself
  - Example: \`note("c e g").superimpose(add(note(7)))\`

### Time Modifiers
- \`.slow(n)\`: Slow down pattern by factor n
- \`.fast(n)\`: Speed up pattern by factor n
- \`.rev()\`: Reverse pattern
- \`.every(n, fn)\`: Apply function every n cycles

### Random Modifiers
- \`.sometimes(fn)\`: Apply function 50% of the time
- \`.rarely(fn)\`: Apply function 25% of the time
- \`.often(fn)\`: Apply function 75% of the time
- \`.random()\`: Randomize event selection

### Conditional Modifiers
- \`.when(test, fn)\`: Apply function when test is true
- \`.off(time, fn)\`: Layer function offset in time

### Effects
- \`.cutoff(freq)\`: Low-pass filter cutoff frequency
- \`.resonance(q)\`: Filter resonance
- \`.delay(time)\`: Delay effect
- \`.room(size)\`: Reverb room size
- \`.gain(level)\`: Volume/amplitude
- \`.pan(position)\`: Stereo panning (-1 to 1)

## Musical Concepts

### Pitch Representation
- Note names: \`"c4 e4 g4"\` (letter + octave)
- MIDI numbers: \`"60 64 67"\`
- Frequency: \`freq("261.63 329.63 392")\` in Hz

### Tonal Functions
- \`.scale('C major')\`: Apply scale to numbers
- \`.chord('C major')\`: Generate chord notes
- \`.voicing()\`: Chord voicing transformations
- \`.transpose(semitones)\`: Transpose by semitones

## Integration Features

### MIDI/OSC
- Send MIDI: \`.midi()\`
- Send OSC: \`.osc()\`
- Control external hardware and software

### Visual Feedback
- \`.scope()\`: Oscilloscope visualization
- \`.fft()\`: Frequency spectrum visualization
- Hydra integration for video synthesis

### Offline Capability
- Progressive Web App (PWA)
- Works offline after initial load
- Save patterns locally

## Common Patterns & Recipes

### Rhythms
\`\`\`javascript
// Basic beat
s("bd sd bd sd")

// Euclidean rhythm
s("bd(3,8), hh(5,8)")

// Subdivisions
s("bd*4 sd*2 bd*4 [sd cp]")
\`\`\`

### Arpeggios
\`\`\`javascript
note("<c e g b>*4").s("piano")
note("c e g b".slow(2)).arp("<up down>")
\`\`\`

### Microrhythms
\`\`\`javascript
s("bd*16").rarely(x => x.fast(2))
s("hh*8").sometimesBy(0.3, x => x.speed(1.5))
\`\`\`

## Best Practices

1. **Start Simple**: Begin with basic patterns and gradually add complexity
2. **Use Block Comment Toggles**: For alternative code sections, use the \`//*\` ... \`//*/\` pattern instead of \`//\` on every line
   - Active code: Just write it normally
   - Alternative code: Wrap in \`//*\` ... \`//*/\` block
   - Users toggle by changing \`//*\` to \`/*\` (removing one \`/\`)
   - Example:
   \`\`\`javascript
   stack(s("bd sd"))  // Active pattern

   //*
   stack(s("bd*2 sd*2"))  // Alternative (commented)
   //*/
   \`\`\`
3. **Experiment**: Try different combinations - Strudel is forgiving
4. **Think in Cycles**: Embrace the cycle-based timing system
5. **Chain Effects**: Build up sounds by chaining multiple effects
6. **Learn Mini-Notation**: Master the compact notation for efficient pattern writing
7. **Explore Euclidean Rhythms**: Great for creating interesting rhythmic patterns

## Helpful Tips

- Default sound is \`triangle\` synthesizer if no \`s()\` specified
- Patterns automatically loop - no need for explicit loops
- Combine patterns with different lengths for polyrhythmic effects
- Use keyboard shortcuts in REPL (cmd-/ to toggle comments)
- Check console for errors if pattern doesn't work
- Sound sources need to be in quotes: \`s("bd")\` not \`s(bd)\`

## Common Issues

1. **No sound**: Check if pattern has \`s()\` or \`note()\`
2. **Wrong rhythm**: Remember spaces divide events in cycle
3. **Syntax errors**: Ensure quotes match (\`""\` for patterns, \`''\` for strings)
4. **Missing dots**: Function chains need dots between them

When helping users, provide working code examples, explain concepts clearly, and encourage experimentation. Strudel is about exploration and creative expression through code!`;

// Validate Strudel code using the transpiler
function validateCode(code) {
  try {
    // Try to transpile the code - if it fails, it will throw an error
    transpiler(code, { addReturn: false });
    return { valid: true, error: null };
  } catch (error) {
    return {
      valid: false,
      error: {
        message: error.message,
        line: error.loc?.line,
        column: error.loc?.column,
        pos: error.pos,
      },
    };
  }
}

// Parse markdown to extract code blocks
function parseCodeBlocks(markdown) {
  const codeBlockRegex = /```(?:javascript|js)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const code = match[1].trim();
    const validation = validateCode(code);
    blocks.push({
      code,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      validation,
    });
  }

  return blocks;
}

// Extract name from code comment
function extractCodeName(code) {
  const firstLine = code.split('\n')[0].replace(/^\/\/\s*/, '').trim();
  return firstLine || 'Untitled';
}

// Component to render a message with waveform code blocks
function MessageContent({ content, role, onAddToTimeline, displayContent, playingPreviewId, setPlayingPreviewId, messageIndex, hasTimeline }) {
  // Use displayContent for user messages if available (shows original request, not augmented with code)
  const textToDisplay = role === 'user' && displayContent ? displayContent : content;
  const codeBlocks = parseCodeBlocks(content);

  if (codeBlocks.length === 0 || role === 'user') {
    return <div className="whitespace-pre-wrap">{textToDisplay}</div>;
  }

  // Split content into parts with code blocks
  const parts = [];
  let lastIndex = 0;

  codeBlocks.forEach((block, idx) => {
    // Add text before code block
    if (block.startIndex > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, block.startIndex),
        key: `text-${idx}`,
      });
    }

    // Add code block with insert button and validation info
    parts.push({
      type: 'code',
      content: block.code,
      validation: block.validation,
      key: `code-${idx}`,
      previewId: `preview-${messageIndex}-${idx}`,
    });

    lastIndex = block.endIndex;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
      key: `text-end`,
    });
  }

  return (
    <div>
      {parts.map((part) => {
        if (part.type === 'text') {
          return <div key={part.key} className="whitespace-pre-wrap">{part.content}</div>;
        } else {
          return (
            <WaveformCard
              key={part.key}
              code={part.content}
              name={extractCodeName(part.content)}
              uniqueId={part.previewId}
              validation={part.validation}
              onAddToTimeline={onAddToTimeline}
              playingPreviewId={playingPreviewId}
              setPlayingPreviewId={setPlayingPreviewId}
              hasTimeline={hasTimeline}
            />
          );
        }
      })}
    </div>
  );
}

// Internal component with encrypted API key management
function AITabInternal({ context }) {
  const { fontFamily } = useSettings();
  const { logout } = useAuth();
  const [apiKey, setApiKey] = useEncryptedLocalStorage('anthropic_api_key', '');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingPreviewId, setPlayingPreviewId] = useState(null);
  const messagesEndRef = useRef(null);

  // Timeline integration
  const timeline = context?.timeline;
  const selectedSegment = context?.selectedSegment;
  const hasTimeline = Boolean(timeline);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handler for adding segment to timeline
  const handleAddToTimeline = {
    tracks: timeline?.tracks || [],
    addSegment: (trackId, code) => {
      if (timeline?.addSegment && timeline?.addTrack) {
        // If no tracks exist, create a default track first
        let targetTrackId = trackId;
        if (timeline.tracks.length === 0) {
          targetTrackId = timeline.addTrack('Track 1');
        }

        // Extract a name from the code or use a default
        let segmentName = code.split('\n')[0].replace(/^\/\/\s*/, '').slice(0, 30) || 'Untitled';
        // Strip "Variation #:", "Approach #:", etc. prefixes
        segmentName = segmentName.replace(/^(Variation|Approach)\s+\d+:\s*/i, '');
        timeline.addSegment(targetTrackId, {
          code,
          startTime: timeline.playheadPosition || 0,
          duration: 8, // Default 8 seconds
          name: segmentName,
        });
      }
    },
  };

  const sendMessage = async () => {
    if (!input.trim() || !apiKey.trim()) {
      setError('Please enter both an API key and a message');
      return;
    }

    // Build context message
    let contextParts = [];

    // Include selected segment context if available
    if (selectedSegment) {
      contextParts.push(`Currently selected segment: "${selectedSegment.name}" on track "${selectedSegment.trackName}"
\`\`\`javascript
${selectedSegment.code}
\`\`\``);
    }

    // Include current editor code
    const currentCode = context?.editorRef?.current?.code || '';
    if (currentCode && currentCode.trim() && !selectedSegment) {
      contextParts.push(`Current code in editor:
\`\`\`javascript
${currentCode}
\`\`\``);
    }

    // Build final message
    let messageContent = input;
    if (contextParts.length > 0) {
      messageContent = `${contextParts.join('\n\n')}

User request: ${input}`;
    }

    const userMessage = {
      role: 'user',
      content: messageContent,
      displayContent: input // Store original input for display
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8096,
          system: SYSTEM_PROMPT,
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.content[0].text,
      };

      // Update messages and get the new array
      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);

      // Check for validation errors in the response
      const codeBlocks = parseCodeBlocks(assistantMessage.content);
      const errors = codeBlocks.filter((block) => !block.validation.valid);

      // Save valid code blocks to history
      codeBlocks.forEach((block) => {
        if (block.validation.valid) {
          addBeatToHistory(block.code);
        }
      });

      // If there are validation errors, automatically send them back to the AI
      if (errors.length > 0) {
        const errorDetails = errors
          .map((block, idx) => {
            const error = block.validation.error;
            return `Code Block ${idx + 1}:
\`\`\`
${block.code}
\`\`\`
Error: ${error.message}${error.line ? ` (Line ${error.line})` : ''}`;
          })
          .join('\n\n');

        const correctionPrompt = `The code you provided has syntax errors. Please fix them and provide corrected code:

${errorDetails}

Please provide a corrected version with valid Strudel/JavaScript syntax.`;

        // Auto-send correction request
        setTimeout(() => {
          handleAutoCorrection(correctionPrompt, updatedMessages);
        }, 500);
      }
    } catch (err) {
      setError(err.message || 'Failed to send message');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCorrection = async (correctionPrompt, currentMessages) => {
    if (!apiKey.trim()) return;

    const userMessage = { role: 'user', content: correctionPrompt };
    const updatedMessages = [...currentMessages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8096,
          system: SYSTEM_PROMPT,
          messages: updatedMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.content[0].text,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save valid code blocks from correction to history
      const codeBlocks = parseCodeBlocks(assistantMessage.content);
      codeBlocks.forEach((block) => {
        if (block.validation.valid) {
          addBeatToHistory(block.code);
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to send correction request');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show API key setup screen if no key is entered
  if (!apiKey.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-w-full p-8 font-sans bg-white dark:bg-gray-900" style={{ fontFamily }}>
        <div className="max-w-md w-full">
          <h3 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-white">꩜ AI Assistant</h3>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            Get help with Strudel patterns, mini-notation, effects, and more
          </p>

          <div className="mb-6">
            <label htmlFor="api-key" className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-200">
              Anthropic API Key:
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Your API key is encrypted using your passkey and stored securely in your browser. It's never sent anywhere except directly to Anthropic.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              <strong>Don't have an API key?</strong>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Get one from{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show chat interface once API key is entered
  return (
    <div className="flex flex-col h-full min-w-full pt-2 font-sans pb-4 px-4" style={{ fontFamily }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">꩜ AI Assistant</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setApiKey('')}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Change API key"
          >
            Change Key
          </button>
          <button
            onClick={logout}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            title="Logout and clear passkey"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-4 border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-900/50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2">Ask me anything about Strudel!</p>
            <p className="text-sm">I can help you with patterns, mini-notation, effects, and more.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900/30 ml-8'
                    : 'bg-gray-200 dark:bg-gray-800 mr-8'
                }`}
              >
                <div className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </div>
                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <MessageContent
                    content={msg.content}
                    role={msg.role}
                    onAddToTimeline={handleAddToTimeline}
                    displayContent={msg.displayContent}
                    playingPreviewId={playingPreviewId}
                    setPlayingPreviewId={setPlayingPreviewId}
                    messageIndex={idx}
                    hasTimeline={hasTimeline}
                  />
                </div>
              </div>
            ))}
            {loading && (
              <div className="p-3 rounded-lg bg-gray-200 dark:bg-gray-800 mr-8">
                <div className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">AI Assistant</div>
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about Strudel patterns, mini-notation, effects..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows="3"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !apiKey.trim() || !input.trim()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-md font-medium transition-colors self-end disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// Export component - authentication is now handled at Panel level
export function AITab({ context }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AITabInternal context={context} />;
}
