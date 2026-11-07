import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { createPicture, deletePicture, generatePictureDescription, getAdminPictures, updatePicture, type Picture } from '../../api/pictures';
import { reportError, showToast } from '../../utils/toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
  const load = () => getAdminPictures().then(setPictures).catch((error) => reportError(error, 'Не удалось загрузить картинки'));
  useEffect(() => { void load(); }, []);

  const add = async () => {
    if (!files.length) { showToast('Выберите хотя бы одну картинку'); return; }
    setBusy(true);
    try {
      for (const file of files) {
        const dataUrl = await readFile(file);
        const picture = await createPicture({ dataUrl, isActive: true });
        if (autoDescribe) await generatePictureDescription(picture.id);
      }
      setFiles([]); setAutoDescribe(false); await load(); showToast(`Добавлено картинок: ${files.length}`, 'success');
    } catch (error) { reportError(error, autoDescribe ? 'Не удалось добавить или описать картинки' : 'Не удалось добавить картинки'); }
    finally { setBusy(false); }
  };

  const openEdit = (picture: Picture) => { setEditingId(picture.id); setEditTitle(picture.title || ''); setEditDescription(picture.description || ''); };
  const fillWithAI = async (id: string) => {
    setBusy(true);
    try { const result = await generatePictureDescription(id); setPictures((items) => items.map((item) => item.id === id ? result : item)); setEditTitle(result.title || ''); setEditDescription(result.description || ''); showToast('Название и описание заполнены ИИ', 'success'); }
    catch (error) { reportError(error, 'Не удалось заполнить описание через ИИ'); }
    finally { setBusy(false); }
  };

  return <div className="pictures-admin">
    <div className="section-toolbar"><h3 className="section-heading">Картинки для описания ({pictures.length})</h3></div>
    <div className="picture-upload card">
      <label className="picture-file-label" htmlFor="picture-file"><ImagePlus size={18} /> Выбрать изображения (до 5 МБ каждое)</label>
      <input id="picture-file" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const oversized = selected.find((file) => file.size > MAX_FILE_SIZE); if (oversized) { showToast(`Файл «${oversized.name}» слишком большой`); return; } setFiles(selected); }} />
      {files.length > 0 && <span className="setting-toggle-desc">Выбрано файлов: {files.length}</span>}
      <label className="picture-ai-checkbox"><input type="checkbox" checked={autoDescribe} onChange={(event) => setAutoDescribe(event.target.checked)} /> Автоматически заполнить название и описание через ИИ</label>
      <button className="btn-primary" disabled={busy || !files.length} onClick={() => void add()}><ImagePlus size={16} /> Добавить картинки</button>
    </div>
    <div className="pictures-admin-grid">{pictures.map((picture) => <div className="card picture-admin-card" key={picture.id}>
      <img src={picture.dataUrl} alt={picture.title || 'Картинка'} />
      <div className="picture-admin-card-footer"><span>{picture.title || 'Без названия'}</span><div><button className="icon-btn" aria-label="Редактировать картинку" onClick={() => openEdit(picture)}><Pencil size={16} /></button><button className="icon-btn icon-btn--danger" aria-label="Удалить картинку" onClick={async () => { if (!confirm('Удалить картинку?')) return; try { await deletePicture(picture.id); await load(); } catch (error) { reportError(error, 'Не удалось удалить картинку'); } }}><Trash2 size={16} /></button></div></div>
      {picture.description && <p className="picture-admin-description">{picture.description}</p>}
      {editingId === picture.id && <div className="picture-edit-form">
        <input className="text-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Название" aria-label="Название картинки" />
        <textarea className="text-input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Описание на русском" rows={5} aria-label="Описание картинки" />
        <button className="btn-secondary btn-xs" disabled={busy} onClick={() => void fillWithAI(picture.id)}><Sparkles size={14} /> Заполнить с помощью ИИ</button>
        <button className="btn-primary btn-xs" disabled={busy} onClick={async () => { try { const result = await updatePicture(picture.id, { title: editTitle, description: editDescription }); setPictures((items) => items.map((item) => item.id === picture.id ? result : item)); setEditingId(null); showToast('Картинка обновлена', 'success'); } catch (error) { reportError(error, 'Не удалось сохранить картинку'); } }}>Сохранить</button>
      </div>}
      <button className="btn-secondary btn-xs" onClick={async () => { try { await updatePicture(picture.id, { isActive: !picture.isActive }); await load(); } catch (error) { reportError(error, 'Не удалось изменить статус картинки'); } }}>{picture.isActive ? 'Скрыть из тренажёра' : 'Показывать в тренажёре'}</button>
    </div>)}</div>
  </div>;
}
