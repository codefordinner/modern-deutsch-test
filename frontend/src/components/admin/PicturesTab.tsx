import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { createPicture, deletePicture, generatePictureDescription, getAdminPictures, updatePicture, type Picture } from '../../api/pictures';
import { reportError, showToast } from '../../utils/toast';

// The API limits the resulting Base64 Data URL to 5 MiB. Base64 is larger
// than the source file, so the practical source-file limit is lower.
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;
const MAX_FILE_SIZE = Math.floor(MAX_DATA_URL_LENGTH * 0.72);
const ALLOWED_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать файл')); reader.readAsDataURL(file);
});

export function PicturesTab() {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [autoDescribe, setAutoDescribe] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setPictures(await getAdminPictures());
    } catch (error) {
      setLoadError(true);
      reportError(error, 'Не удалось загрузить картинки');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!files.length) { showToast('Выберите хотя бы одну картинку'); return; }
    setBusy(true);
    let added = 0;
    try {
      for (const file of files) {
        const dataUrl = await readFile(file);
        const picture = await createPicture({ dataUrl, isActive: true });
        added += 1;
        if (autoDescribe) await generatePictureDescription(picture.id);
      }
      setFiles([]); setAutoDescribe(false); await load(); showToast(`Добавлено картинок: ${files.length}`, 'success');
    } catch (error) {
      if (added > 0) showToast(`Добавлено картинок: ${added} из ${files.length}. Остальные не удалось обработать.`);
      // Do not leave successfully created files selected: retrying would
      // create duplicates. The current file is considered processed once its
      // record has been created, even if AI metadata generation failed.
      setFiles(files.slice(added));
      setAutoDescribe(false);
      reportError(error, autoDescribe ? 'Не удалось добавить или описать картинки' : 'Не удалось добавить картинки');
      await load();
    }
    finally { setBusy(false); }
  };

  const openEdit = (picture: Picture) => { setEditingId(picture.id); setEditTitle(picture.title || ''); setEditDescription(picture.description || ''); };
  const fillWithAI = async (id: string) => {
    setBusy(true);
    try { const result = await generatePictureDescription(id); setPictures((items) => items.map((item) => item.id === id ? result : item)); setEditTitle(result.title || ''); setEditDescription(result.description || ''); showToast('Название и описание заполнены ИИ', 'success'); }
    catch (error) { reportError(error, 'Не удалось заполнить описание через ИИ'); }
    finally { setBusy(false); }
  };
  const saveEdit = async (id: string) => {
    setBusy(true);
    try {
      const result = await updatePicture(id, { title: editTitle, description: editDescription });
      setPictures((items) => items.map((item) => item.id === id ? result : item));
      setEditingId(null);
      showToast('Картинка обновлена', 'success');
    } catch (error) {
      reportError(error, 'Не удалось сохранить картинку');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (picture: Picture) => {
    if (!confirm('Удалить картинку?')) return;
    setBusy(true);
    try {
      await deletePicture(picture.id);
      if (editingId === picture.id) setEditingId(null);
      await load();
      showToast('Картинка удалена', 'success');
    } catch (error) {
      reportError(error, 'Не удалось удалить картинку');
    } finally {
      setBusy(false);
    }
  };
  const toggleActive = async (picture: Picture) => {
    setBusy(true);
    try {
      await updatePicture(picture.id, { isActive: !picture.isActive });
      await load();
    } catch (error) {
      reportError(error, 'Не удалось изменить статус картинки');
    } finally {
      setBusy(false);
    }
  };

  return <div className="pictures-admin">
    <div className="section-toolbar"><h3 className="section-heading">Картинки для описания ({pictures.length})</h3></div>
    <div className="picture-upload card">
      <label className="picture-file-label" htmlFor="picture-file"><ImagePlus size={18} /> Выбрать изображения (до 3,7 МБ каждое)</label>
      <input id="picture-file" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const invalid = selected.find((file) => file.size > MAX_FILE_SIZE || !ALLOWED_FILE_TYPES.has(file.type)); if (invalid) { event.target.value = ''; showToast(`Файл «${invalid.name}» имеет неподдерживаемый формат или превышает 3,7 МБ`); return; } setFiles(selected); }} />
      {files.length > 0 && <span className="setting-toggle-desc">Выбрано файлов: {files.length}</span>}
      <label className="picture-ai-checkbox"><input type="checkbox" checked={autoDescribe} onChange={(event) => setAutoDescribe(event.target.checked)} /> Автоматически заполнить название и описание через ИИ</label>
      <button type="button" className="btn-primary" disabled={busy || !files.length} onClick={() => void add()}><ImagePlus size={16} /> {busy ? 'Обработка…' : 'Добавить картинки'}</button>
    </div>
    {loading && <div className="centered-message pictures-admin-message">Загрузка картинок…</div>}
    {!loading && loadError && <div className="pictures-admin-empty"><p>Не удалось загрузить список картинок.</p><button type="button" className="btn-secondary" onClick={() => void load()}>Повторить</button></div>}
    {!loading && !loadError && pictures.length === 0 && <div className="pictures-admin-empty"><p>Картинки ещё не добавлены.</p><span>Загрузите изображения выше, чтобы они появились в тренажёре.</span></div>}
    {!loading && !loadError && pictures.length > 0 && <div className="pictures-admin-grid">{pictures.map((picture) => <div className={`card picture-admin-card ${picture.isActive ? '' : 'is-inactive'}`} key={picture.id}>
      <img src={picture.dataUrl} alt={picture.title || 'Картинка'} />
      <div className="picture-admin-card-footer"><div className="picture-admin-card-title"><span>{picture.title || 'Без названия'}</span><small>{picture.isActive ? 'Показывается в тренажёре' : 'Скрыта из тренажёра'}</small></div><div className="picture-admin-card-tools"><button type="button" className="icon-btn" disabled={busy} aria-label="Редактировать картинку" onClick={() => openEdit(picture)}><Pencil size={16} /></button><button type="button" className="icon-btn icon-btn--danger" disabled={busy} aria-label="Удалить картинку" onClick={() => void remove(picture)}><Trash2 size={16} /></button></div></div>
      {picture.description && <p className="picture-admin-description">{picture.description}</p>}
      {editingId === picture.id && <div className="picture-edit-form">
        <input className="text-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Название" aria-label="Название картинки" />
        <textarea className="text-input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Описание на русском" rows={5} aria-label="Описание картинки" />
        <div className="picture-edit-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => void fillWithAI(picture.id)}><Sparkles size={14} /> Заполнить с помощью ИИ</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveEdit(picture.id)}>Сохранить</button></div>
      </div>}
      <button type="button" className="btn-secondary picture-status-button" disabled={busy} onClick={() => void toggleActive(picture)}>{picture.isActive ? 'Скрыть из тренажёра' : 'Показывать в тренажёре'}</button>
    </div>)}</div>}
  </div>;
}
