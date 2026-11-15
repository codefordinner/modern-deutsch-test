import { useCallback, useEffect, useRef, useState } from 'react';
import { addDictationPunctuation, getSpeechRecognition } from '../utils/dictation';
import { reportError } from '../utils/toast';

export function useSpeechDictation(options: { onText: (text: string) => void; getCurrentText: () => string; onStopAudio: () => void }) {
  const { onText, getCurrentText, onStopAudio } = options;
  const [state, setState] = useState<'idle' | 'listening'>('idle');
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const sessionRef = useRef(0);
  const endedRef = useRef<Promise<void> | null>(null);
  const baseRef = useRef('');
  const onTextRef = useRef(onText);
  const getCurrentTextRef = useRef(getCurrentText);
  const stopAudioRef = useRef(onStopAudio);

  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { getCurrentTextRef.current = getCurrentText; }, [getCurrentText]);
  useEffect(() => { stopAudioRef.current = onStopAudio; }, [onStopAudio]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    recognitionRef.current?.stop();
    stopAudioRef.current();
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      reportError(new Error('Распознавание речи не поддерживается'), 'Голосовой ввод недоступен в Firefox. Микрофон работает, но Firefox не поддерживает встроенное распознавание речи. Используйте Chrome/Edge или введите текст вручную.');
      return false;
    }
    const session = ++sessionRef.current;
    const previous = recognitionRef.current;
    if (previous) {
      previous.stop();
      if (endedRef.current) await Promise.race([endedRef.current, new Promise<void>((resolve) => window.setTimeout(resolve, 1500))]);
      if (session !== sessionRef.current) return false;
      if (recognitionRef.current === previous) recognitionRef.current = null;
    }
    const recognition = new Recognition();
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    let resolveEnded!: () => void;
    const ended = new Promise<void>((resolve) => { resolveEnded = resolve; });
    endedRef.current = ended;
    baseRef.current = getCurrentTextRef.current().trim();
    setState('listening');
    recognition.onresult = (event) => {
      if (session !== sessionRef.current) return;
      let finalText = '';
      let interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index]?.[0];
        if (!result) continue;
        if (result.isFinal) finalText += `${finalText ? ' ' : ''}${result.transcript.trim()}`;
        else interimText += `${interimText ? ' ' : ''}${result.transcript.trim()}`;
      }
      const raw = `${finalText} ${interimText}`.trim();
      const base = baseRef.current;
      const spoken = addDictationPunctuation(raw, !base || /[.!?]\s*$/.test(base));
      const separator = base && spoken && /^[,.;:!?]/u.test(spoken) ? '' : base ? ' ' : '';
      onTextRef.current(spoken ? `${base}${separator}${spoken}` : base);
    };
    recognition.onerror = (event) => {
      if (session !== sessionRef.current) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') reportError(new Error(event.error), 'Нет доступа к микрофону. Разрешите доступ к микрофону в настройках браузера.');
      else if (event.error === 'audio-capture' || event.error === 'no-speech') reportError(new Error(event.error), event.error === 'audio-capture' ? 'Не удалось включить микрофон.' : 'Речь не распознана. Попробуйте ещё раз.');
      stopAudioRef.current();
      setState('idle');
    };
    recognition.onend = () => {
      resolveEnded();
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
        if (endedRef.current === ended) endedRef.current = null;
      }
      if (session === sessionRef.current) setState('idle');
    };
    recognition.onstart = () => { if (session === sessionRef.current) setState('listening'); };
    try { recognition.start(); return true; }
    catch (error) {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      stopAudioRef.current();
      setState('idle');
      reportError(error, 'Не удалось запустить диктовку. Проверьте доступ к микрофону.');
      return false;
    }
  }, []);

  useEffect(() => () => {
    sessionRef.current += 1;
    recognitionRef.current?.stop();
    stopAudioRef.current();
  }, []);

  return { state, start, stop };
}
