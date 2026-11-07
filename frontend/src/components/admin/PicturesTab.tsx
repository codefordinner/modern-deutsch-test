import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { createPicture, deletePicture, getAdminPictures, updatePicture, type Picture } from '../../api/pictures';
import { reportError, showToast } from '../../utils/toast';

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Не удалось прочитать файл')); reader.readAsDataURL(file);
});

export function PicturesTab() {
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [title, setTitle] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const load = () => getAdminPictures().then(setPictures).catch((error) => reportError(error, 'Не удалось загрузить картинки'));
  useEffect(() => { void load(); }, []);
  const add = async () => {
    if (!dataUrl) return showToast('Выберите изображение');
    try { await createPicture({ title, dataUrl, isActive: true }); setTitle(''); setDataUrl(''); await load(); showToast('Картинка добавлена', 'success'); }
    catch (error) { reportError(error, 'Не удалось добавить картинку'); }
  };
  return <div className="pictures-admin">
    <div className="section-toolbar"><h3 className="section-heading">Картинки для описания ({pictures.length})</h3></div>
    <div className="picture-upload card">
      <label className="field-label" htmlFor="picture-title">Название (необязательно)</label>
      <input id="picture-title" className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: В кафе" />
      <label className="picture-file-label" htmlFor="picture-file"><ImagePlus size={18} /> Выбрать изображение (до 5 МБ)</label>
      <input id="picture-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size <= 5 * 1024 * 1024) readFile(file).then(setDataUrl).catch((error) => reportError(error, 'Не удалось прочитать файл')); else if (file) showToast('Файл слишком большой'); }} />
      <button className="btn-primary" onClick={add}>Добавить картинку</button>
    </div>
    <div className="pictures-admin-grid">{pictures.map((picture) => <div className="card picture-admin-card" key={picture.id}>
      <img src={picture.dataUrl} alt={picture.title || 'Картинка'} /><div className="picture-admin-card-footer"><span>{picture.title || 'Без названия'}</span><div><button className="icon-btn" aria-label="Редактировать картинку" onClick={() => { setEditingId(picture.id); setEditTitle(picture.title || ''); setEditDescription(picture.description || ''); }}><Pencil size={16} /></button><button className="icon-btn icon-btn--danger" aria-label="Удалить картинку" onClick={async () => { if (!confirm('Удалить картинку?')) return; try { await deletePicture(picture.id); await load(); } catch (error) { reportError(error, 'Не удалось удалить картинку'); } }}><Trash2 size={16} /></button></div></div>
      {editingId === picture.id && <div className="picture-edit-form">
        <input className="text-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Название" aria-label="Название картинки" />
        <textarea className="text-input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Описание" rows={5} aria-label="Описание картинки" />
        <button className="btn-secondary btn-xs" onClick={() => showToast('Заполнение с помощью ИИ пока недоступно', 'info')}><Sparkles size={14} /> Заполнить с помощью ИИ</button>
        <button className="btn-primary btn-xs" onClick={async () => { try { await updatePicture(picture.id, { title: editTitle, description: editDescription }); setEditingId(null); await load(); showToast('Картинка обновлена', 'success'); } catch (error) { reportError(error, 'Не удалось сохранить картинку'); } }}>Сохранить</button>
      </div>}
      <button className="btn-secondary btn-xs" onClick={async () => { try { await updatePicture(picture.id, { isActive: !picture.isActive }); await load(); } catch (error) { reportError(error, 'Не удалось изменить статус картинки'); } }}>{picture.isActive ? 'Скрыть из тренажёра' : 'Показывать в тренажёре'}</button>
    </div>)}</div>
  </div>;
}
