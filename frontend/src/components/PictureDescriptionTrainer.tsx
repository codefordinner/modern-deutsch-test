import { useEffect, useRef, useState } from 'react';
import { Check, Play, RotateCcw, Send, SkipForward } from 'lucide-react';
import { checkPictureAnswer, getPictures, type Picture, type PictureCheckResult } from '../api/pictures';
import { reportError } from '../utils/toast';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  resultIndex?: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
  onresult: ((event: SpeechRecognitionLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function PictureDescriptionTrainer() {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<PictureCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [speechState, setSpeechState] = useState<'idle' | 'listening'>('idle');
  const [isExamMode, setIsExamMode] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    getPictures().then((items) => {
      setPictures(items);
      if (items.length > 1) setIndex(Math.floor(Math.random() * items.length));
    }).catch((error) => reportError(error, 'Не удалось загрузить картинки'));
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  useEffect(() => {
    if (!isExamMode || startedAt === null || elapsed < 90) return;
    setStartedAt(null); setIsFinished(true);
  }, [elapsed, isExamMode, startedAt]);

  const picture = pictures.length ? pictures[index % pictures.length] : null;
  useEffect(() => {
    try { const draft = JSON.parse(localStorage.getItem('picture_draft') || 'null') as { answer?: string } | null; if (draft?.answer) setAnswer(draft.answer); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { if (answer) localStorage.setItem('picture_draft', JSON.stringify({ pictureId: picture?.id, answer })); else localStorage.removeItem('picture_draft'); } catch { /* storage unavailable */ }
  }, [answer, picture?.id]);
  const start = () => { setStartedAt(Date.now()); setElapsed(0); setIsFinished(false); setAnswer(''); setResult(null); setSelectedSegment(null); };
  const skip = () => {
    if (pictures.length > 1) {
      let nextIndex = index;
      while (nextIndex === index) nextIndex = Math.floor(Math.random() * pictures.length);
      setIndex(nextIndex);
    }
    setStartedAt(null); setElapsed(0); setIsFinished(false); setAnswer(''); setResult(null); setSelectedSegment(null);
  };
  const finish = () => { setStartedAt(null); setIsFinished(true); };
  const submit = async () => {
    setChecking(true);
    try { setResult(await checkPictureAnswer(picture?.id ?? '', answer)); try { localStorage.removeItem('picture_draft'); } catch { /* storage unavailable */ } }
    catch (error) { reportError(error, 'Не удалось проверить описание'); }
    finally { setChecking(false); }
  };
  const restart = () => { setStartedAt(Date.now()); setElapsed(0); setIsFinished(false); setAnswer(''); setResult(null); setSelectedSegment(null); };
  const next = () => { skip(); };
  const toggleSpeech = () => {
    const speechWindow = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { reportError(new Error('Диктовка не поддерживается'), 'Диктовка недоступна в этом браузере'); return; }
    if (speechState === 'listening') { recognitionRef.current?.stop(); return; }
    const recognition = new Recognition(); recognition.lang = 'de-DE'; recognition.continuous = true;
    recognition.onresult = (event) => { const text = Array.from(event.results).slice(event.resultIndex || 0).map((item) => item[0].transcript).join(''); setAnswer((current) => `${current}${current ? ' ' : ''}${text}`); };
    recognition.onend = () => { setSpeechState('idle'); recognitionRef.current = null; }; recognitionRef.current = recognition; setSpeechState('listening'); recognition.start();
  };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (!picture) return <div className="centered-message">Картинки пока не добавлены администратором.</div>;

  return (
    <section className="picture-trainer" aria-label="Описание картинки">
      <div className="picture-trainer-heading">
        <div><h2>Описание картинки</h2><p>Представьте, что вы сдаёте устную часть экзамена.</p></div>
      </div>
      <label className="picture-mode-switch"><input type="checkbox" checked={isExamMode} onChange={(event) => setIsExamMode(event.target.checked)} /> Экзаменационный режим (90 секунд)</label>
      <div className="picture-stage is-visible">
        <img src={picture.dataUrl} alt={picture.title || 'Картинка для описания'} />
        <div className={`picture-stage-timer ${startedAt !== null || isFinished ? 'is-active' : ''}`} aria-live="polite">{formatTime(elapsed)}</div>
      </div>
      {(startedAt !== null || (isFinished && !result)) && <label className="picture-answer-label" htmlFor="picture-answer">Ваше описание</label>}
      {(startedAt !== null || (isFinished && !result)) && <><textarea id="picture-answer" className="picture-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Введите описание картинки на немецком…" rows={7} /><button type="button" className="btn-secondary" onClick={toggleSpeech}>{speechState === 'listening' ? 'Остановить диктовку' : 'Диктовать по-немецки'}</button></>}
      <div className="picture-actions">
        {startedAt === null && !isFinished ? <button className="btn-primary" onClick={start}><Play size={17} /> Показать картинку</button> : startedAt !== null ? <button className="btn-primary" onClick={finish}><Check size={17} /> Завершить</button> : <>
          <button className="btn-primary" disabled={checking || !answer.trim()} onClick={() => void submit()}><Send size={17} /> {checking ? 'Проверка…' : 'Отправить ответ'}</button>
          <button className="btn-secondary" onClick={restart}><RotateCcw size={17} /> Начать заново</button>
          <button className="btn-secondary" onClick={next}><SkipForward size={17} /> Следующая картинка</button>
        </>}
        {startedAt !== null && <button className="btn-secondary" onClick={skip}><SkipForward size={17} /> Пропустить</button>}
      </div>
      {result && <div className="picture-check-result" aria-live="polite">
        <div className="picture-score">Оценка: <strong>{result.score} / {result.maxScore}</strong></div>
        <div className="picture-categories">Содержание: {result.categories.content}/25 · Грамматика: {result.categories.grammar}/25 · Лексика: {result.categories.vocabulary}/25 · Связность: {result.categories.fluency}/25 · Уровень: {result.level}</div>
        <div className="picture-report">{result.report}</div>
        <div className="picture-marked-text" aria-label="Проверенный текст">{result.segments.map((segment, segmentIndex) => <button type="button" key={`${segmentIndex}-${segment.text}`} className={`picture-segment picture-segment--${segment.severity} ${selectedSegment === segmentIndex ? 'is-selected' : ''}`} onClick={() => setSelectedSegment(selectedSegment === segmentIndex ? null : segmentIndex)} title={segment.note}>{segment.text}</button>)}</div>
        {selectedSegment !== null && result.segments[selectedSegment]?.note && <div className="picture-segment-note">{result.segments[selectedSegment].note}</div>}
        {result.correctedText && result.correctedText !== answer && <div className="picture-corrected"><strong>Исправленный вариант:</strong><br />{result.correctedText}</div>}
        {result.usefulExpressions.length > 0 && <details><summary>Полезные выражения</summary><ul>{result.usefulExpressions.map((item) => <li key={item}>{item}</li>)}</ul></details>}
        <button className="btn-secondary" onClick={next}><SkipForward size={17} /> Следующая картинка</button>
      </div>}
      <div className="picture-counter">Случайная картинка · {pictures.length} доступно</div>
    </section>
  );
}
