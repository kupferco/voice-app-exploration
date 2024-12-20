import React, { useState, useCallback, useRef, useEffect } from 'react';
import { initializeSession, clearSessionId } from './src/sessionManager';
import { WebSocketProvider } from './src/WebSocketManager';
import GoogleSpeechStream from './src/GoogleSpeechStreamer';
import TTSService from './src/TTSService';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const ttsRef = useRef<{ stop: () => void } | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(''); // State for the input field

  const streamControls = useRef<{
    start: () => void;
    stop: () => void;
    toggleMute: () => void;
    isMuted: () => boolean;
  } | null>(null);

  useEffect(() => {
    // Initialize the session
    const id = initializeSession();
    setSessionId(id);

    // Fetch the existing system prompt for the session
    const fetchPrompt = async () => {
      if (!sessionId) return;
      try {
        const response = await fetch(`https://e7e2-2a00-23c8-16b2-8301-b4ba-6b2a-34a2-ca6a.ngrok-free.app/api/gemini/system-prompt?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true', // Bypass the Ngrok intro page
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch system prompt.');
          return;
        }

        const data = await response.json();
        setPrompt(data.prompt || '');
        // }, 1000)
      } catch (error) {
        console.error('Error fetching system prompt:', error);
      }
    };

    if (id) fetchPrompt();
  }, [sessionId]);

  const handleClearSession = () => {
    clearSessionId();
    setSessionId(null);
    console.log('Session cleared.');
  };

  const handleAudioStreamReady = (stream: MediaStream | null) => {
    setAudioStream(stream);
  };
  const handleReady = useCallback((controls: typeof streamControls.current) => {
    streamControls.current = controls;
  }, []);

  const handleTranscript = useCallback((newTranscript: string, isFinal: boolean) => {
    if (isFinal) {
      // console.log("Transcript ::", newTranscript);
      setTranscript((prev) => `${prev} ${newTranscript}`);
    }
  }, []);

  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  const handleStart = () => {
    if (streamControls.current) {
      streamControls.current.start();
      setIsMicOn(true); // Set microphone state to on
    } else {
      console.error('Stream controls are not initialized.');
    }
  };

  const handleStop = () => {
    if (streamControls.current) {
      streamControls.current.stop();
      setIsMicOn(false); // Set microphone state to off
      handleStopTTS();
    } else {
      console.error('Stream controls are not initialized.');
    }
  };

  const handleMute = () => {
    if (streamControls.current) {
      streamControls.current.toggleMute();
      setIsMuted(streamControls.current.isMuted());
    } else {
      console.error('Stream controls are not initialized.');
    }
  };

  const handleTTSReady = (controls: { stop: () => void }) => {
    ttsRef.current = controls;
  };

  const handleStopTTS = () => {
    if (ttsRef.current) {
      ttsRef.current.stop();
    } else {
      console.error('TTS controls are not initialized.');
    }
  };

  const savePrompt = async () => {
    if (!prompt.trim()) {
      alert('System prompt cannot be empty.');
      return;
    }

    try {
      const response = await fetch('https://e7e2-2a00-23c8-16b2-8301-b4ba-6b2a-34a2-ca6a.ngrok-free.app/api/gemini/system-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newPrompt: prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update system prompt:', errorText);
        alert('Error updating system prompt. Check logs for details.');
        return;
      }

      const result = await response.json();
      alert(result.message); // Success message
    } catch (error) {
      console.error('Error updating system prompt:', error);
      alert('An error occurred while updating the system prompt.');
    }
  };

  return (
    <WebSocketProvider>
      <div>
        <h1>Welcome to the Voice App</h1>
        <p>Your session ID: {sessionId || 'No active session'}</p>
        <button onClick={handleClearSession}>Clear conversation history</button>
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter new system prompt"
            style={{ width: '100%', height: '50px' }}
          />
          <button onClick={savePrompt}>Save Prompt</button>
        </div>
        <p>Transcript: {transcript}</p>
        <button onClick={handleStart} disabled={isMicOn}>
          Start
        </button>
        <button onClick={handleStop} disabled={!isMicOn}>
          Stop
        </button>
        <button onClick={handleMute} disabled={!isMicOn}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={handleStopTTS} disabled={!isMicOn}>Interrrupt TTS</button>
        <GoogleSpeechStream
          onTranscript={handleTranscript}
          onReady={handleReady}
          onMuteChange={handleMuteChange}
          onAudioStreamReady={handleAudioStreamReady}
        />
        <TTSService audioStream={audioStream} onReady={handleTTSReady} />
      </div>
    </WebSocketProvider>
  );
};

export default App;
