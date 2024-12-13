import React, { useEffect, useRef, useState } from 'react';

interface GoogleSpeechStreamProps {
    onTranscript: (transcript: string, isFinal: boolean) => void;
    onReady: (controlFunctions: {
        start: () => void;
        stop: () => void;
        unmute: () => void;
        toggleMute: () => void;
        isMuted: () => boolean;
    }) => void;
    onMuteChange: (muted: boolean) => void; // Add this
}


const GoogleSpeechStream: React.FC<GoogleSpeechStreamProps> = ({ onTranscript, onReady, onMuteChange }) => {
    const wsRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [muted, setMuted] = useState(false);
    const mutedBufferRef = useRef<Blob[]>([]);
    const mutedRef = useRef(false);

    const WEBSOCKET_ADDRESS_HTTP = 'ws://localhost:8082';
    const WEBSOCKET_ADDRESS_HTTPS = 'wss://localhost:8080';
    // const WEBSOCKET_ADDRESS_HTTPS = 'wss://localhost:8080';
    // const WEBSOCKET_ADDRESS_HTTPS = 'wss://voice-ui-proxy-server-14953211771.europe-west2.run.app';

    const toggleMute = () => {
        setMuted((prev) => {
            const newMuted = !prev;
            mutedRef.current = newMuted;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const action = newMuted ? 'stop' : 'start';
                console.log(`Sending WebSocket action: ${action}`);
                wsRef.current.send(JSON.stringify({ action }));
            }
            if (!newMuted && mediaRecorderRef.current) {
                console.log('Flushing initial audio data after unmute');
                mediaRecorderRef.current.requestData(); // Force MediaRecorder to send buffered data
            }
            return newMuted;
        });
    };

    // Use `useEffect` to call `onMuteChange` when `muted` state changes
    useEffect(() => {
        onMuteChange(muted);
    }, [muted, onMuteChange]);

    const isMuted = () => mutedRef.current; // Return the current value

    useEffect(() => {
        let audioStream: MediaStream | null = null;

        const start = async () => {
            console.log('Starting recording...');

            // Ensure previous streams are cleaned up
            if (mediaRecorderRef.current) {
                console.log('Stopping previous MediaRecorder...');
                mediaRecorderRef.current.ondataavailable = null; // Remove the event handler
                mediaRecorderRef.current.stop(); // Stop MediaRecorder
                mediaRecorderRef.current = null; // Clear the reference
            }

            if (audioStream) {
                console.log('Stopping previous audio stream...');
                audioStream.getTracks().forEach((track) => track.stop());
                audioStream = null;
            }

            // Reinitialize WebSocket if needed
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                console.log('Reinitializing WebSocket connection');
                wsRef.current = new WebSocket(WEBSOCKET_ADDRESS_HTTPS);

                wsRef.current.onopen = () => {
                    console.log('WebSocket connection established');
                    wsRef.current?.send(JSON.stringify({ action: 'start' })); // Notify server to start
                };

                wsRef.current.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log('Received message:', message);
                    if (message.transcript) {
                        onTranscript(message.transcript, message.isFinal);
                    }
                };

                wsRef.current.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };

                wsRef.current.onclose = (event) => {
                    console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                };
            } else {
                console.log('WebSocket is already open');
                wsRef.current.send(JSON.stringify({ action: 'start' })); // Notify server to start
            }

            // Request microphone access and start recording
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Save to a reference
                const mediaRecorder = new MediaRecorder(audioStream);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    // console.log("MediaRecorder data available:", event.data.size, "bytes");
                    if (!mutedRef.current && wsRef.current?.readyState === WebSocket.OPEN && mediaRecorderRef.current) {
                        // console.log("Sending data to WebSocket...");
                        wsRef.current.send(event.data); // Send audio data only if active
                    }
                };


                mediaRecorder.start(250); // Send data every 250ms
                console.log('Recording started.');
            } catch (error) {
                console.error('Failed to access microphone:', error);
            }
        };



        const stop = () => {
            console.log('Stopping recording...');

            // Stop the MediaRecorder
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.ondataavailable = null; // Remove the event handler
                mediaRecorderRef.current.stop(); // Stop MediaRecorder
                mediaRecorderRef.current = null; // Clear the reference
                if (mutedRef.current)
                    toggleMute();

                console.log('555 MediaRecorder stopped');
            }

            // Stop all audio tracks
            if (audioStream) {
                audioStream.getTracks().forEach((track) => track.stop());
                audioStream = null;
                console.log('Audio tracks stopped');
            }

            // Notify the server to stop processing
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log('Sending "stop" action to server');
                wsRef.current.send(JSON.stringify({ action: 'stop' })); // Tell server to stop streaming
            }

            // Close the WebSocket connection
            if (wsRef.current) {
                console.log('Closing WebSocket connection');
                wsRef.current.close();
                wsRef.current = null;
            }
        };

        const unmute = () => {
            return;
            console.log('Unmute please!!');
            console.log(wsRef.current);
            console.log(wsRef.current?.readyState);
            console.log(WebSocket.OPEN);
            console.log('Reinitializing WebSocket connection');
            wsRef.current = new WebSocket(WEBSOCKET_ADDRESS_HTTPS);

            wsRef.current.onopen = () => {
                console.log('WebSocket connection established');
                wsRef.current?.send(JSON.stringify({ action: 'start' })); // Notify server to start
            };

            wsRef.current.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('Received message:', message);
                if (message.transcript) {
                    onTranscript(message.transcript, message.isFinal);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            wsRef.current.onclose = (event) => {
                console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
            };
        }





        console.log('Initialising Websocket!!');

        const ws = new WebSocket(WEBSOCKET_ADDRESS_HTTPS);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connection established.');
            onReady({ start, stop, unmute, toggleMute, isMuted });
        };

        ws.onmessage = (event) => {
            console.log('Received message:', event.data);
            const message = JSON.parse(event.data);
            if (message.transcript) {
                onTranscript(message.transcript, message.isFinal);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
            console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        };

        return () => {
            console.log('Cleaning up WebSocket connection...');
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [onReady, onTranscript]); // Removed `muted` from dependencies    

    return null; // This component does not render any UI
};

export default GoogleSpeechStream;
