import { useEffect, useMemo, useState } from 'react';
import { Check, Image, Play, RotateCcw, Send, SkipForward } from 'lucide-react';
import { getPictures, type Picture } from '../api/pictures';
import { reportError, showToast } from '../utils/toast';

export function PictureDescriptionTrainer() {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [answer, setAnswer] = useState('');

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

  const picture = useMemo(() => pictures.length ? pictures[index % pictures.length] : null, [pictures, index]);
  const start = () => { setStartedAt(Date.now()); setElapsed(0); setIsFinished(false); setAnswer(''); };
  const skip = () => {
    if (pictures.length > 1) {
      let nextIndex = index;
      while (nextIndex === index) nextIndex = Math.floor(Math.random() * pictures.length);
      setIndex(nextIndex);
    }
    setStartedAt(null); setElapsed(0); setIsFinished(false); setAnswer('');
  };
  const finish = () => { setStartedAt(null); setIsFinished(true); };
  const submit = () => showToast('Отправка ответа на сервер пока недоступна', 'info');
  const restart = () => { setStartedAt(Date.now()); setElapsed(0); setIsFinished(false); setAnswer(''); };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (!picture) return <div className="centered-message">Картинки пока не добавлены администратором.</div>;

  return (
    <section className="picture-trainer" aria-label="Описание картинки">
      <div className="picture-trainer-heading">
        <div><h2>Описание картинки</h2><p>Представьте, что вы сдаёте устную часть экзамена.</p></div>
        <div className="picture-timer" aria-live="polite">{formatTime(elapsed)}</div>
      </div>
      <div className={`picture-stage ${startedAt !== null ? 'is-visible' : ''}`}>
        {startedAt !== null || isFinished ? <img src={picture.dataUrl} alt={picture.title || 'Картинка для описания'} /> : <div className="picture-hidden"><Image size={42} /><span>Картинка появится после старта</span></div>}
      </div>
      {(startedAt !== null || isFinished) && <label className="picture-answer-label" htmlFor="picture-answer">Ваше описание</label>}
      {(startedAt !== null || isFinished) && <textarea id="picture-answer" className="picture-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Введите описание картинки…" rows={7} />}
      <div className="picture-actions">
        {startedAt === null && !isFinished ? <button className="btn-primary" onClick={start}><Play size={17} /> Показать картинку</button> : startedAt !== null ? <button className="btn-primary" onClick={finish}><Check size={17} /> Завершить</button> : <>
          <button className="btn-primary" onClick={submit}><Send size={17} /> Отправить ответ</button>
          <button className="btn-secondary" onClick={restart}><RotateCcw size={17} /> Начать заново</button>
        </>}
        {startedAt !== null && <button className="btn-secondary" onClick={skip}><SkipForward size={17} /> Пропустить</button>}
      </div>
      <div className="picture-counter">Случайная картинка · {pictures.length} доступно</div>
    </section>
  );
}
