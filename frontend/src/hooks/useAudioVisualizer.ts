import { useCallback, useEffect, useRef } from 'react';

export function useAudioVisualizer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const waveBarRefs = useRef<HTMLElement[]>([]);
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop());
    microphoneStreamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    waveBarRefs.current.forEach((bar) => { bar.style.height = '4px'; });
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const generation = ++generationRef.current;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContextConstructor();
      microphoneStreamRef.current = stream;
      const analyser = context.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.72;
      context.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      const values = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteFrequencyData(values);
        const bars = waveBarRefs.current;
        const step = Math.max(1, Math.floor(values.length / bars.length));
        bars.forEach((bar, index) => {
          const value = values[Math.min(values.length - 1, index * step)] ?? 0;
          bar.style.height = `${4 + (value / 255) * 14}px`;
        });
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (context) void context.close().catch(() => undefined);
    }
  }, []);

  useEffect(() => stop, [stop]);
  return { start, stop, waveBarRefs };
}
