import { useEffect, useMemo, useState } from 'react';
import { Check, Image, Play, SkipForward } from 'lucide-react';
import { getPictures, type Picture } from '../api/pictures';
import { reportError } from '../utils/toast';

export function PictureDescriptionTrainer() {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    getPictures().then(setPictures).catch((error) => reportError(error, 'Не удалось загрузить картинки'));
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const picture = useMemo(() => pictures.length ? pictures[index % pictures.length] : null, [pictures, index]);
  const start = () => { setStartedAt(Date.now()); setElapsed(0); };
  const next = () => { setIndex((value) => (value + 1) % Math.max(pictures.length, 1)); setStartedAt(null); setElapsed(0); };
  const finish = () => { setStartedAt(null); };
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  if (!picture) return <div className="centered-message">Картинки пока не добавлены администратором.</div>;

  return (
    <section className="picture-trainer" aria-label="Описание картинки">
      <div className="picture-trainer-heading">
        <div><h2>Описание картинки</h2><p>Представьте, что вы сдаёте устную часть экзамена.</p></div>
        <div className="picture-timer" aria-live="polite">{formatTime(elapsed)}</div>
      </div>
      <div className={`picture-stage ${startedAt !== null ? 'is-visible' : ''}`}>
        {startedAt !== null ? <img src={picture.dataUrl} alt={picture.title || 'Картинка для описания'} /> : <div className="picture-hidden"><Image size={42} /><span>Картинка появится после старта</span></div>}
      </div>
      <div className="picture-actions">
        {startedAt === null ? <button className="btn-primary" onClick={start}><Play size={17} /> Старт</button> : <button className="btn-primary" onClick={finish}><Check size={17} /> Завершить</button>}
        <button className="btn-secondary" onClick={next}><SkipForward size={17} /> Следующая картинка</button>
      </div>
      <div className="picture-counter">Картинка {index + 1} из {pictures.length}</div>
    </section>
  );
}
