import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, LoaderCircle, Search, Shield, ShieldOff, Trash2, UserRoundX, RotateCcw } from 'lucide-react';
import { deleteAdminUser, getAdminUserProgress, getAdminUsers, resetUserProgress, setUserAdmin, setUserBanned } from '../../api/adminUsers';
import type { AdminUser, LearnerProgressSnapshot } from '../../api/adminUsers';
import { Modal } from '../Modal';
import { useConfirm } from '../../hooks/useConfirm';
import { reportError, showToast } from '../../utils/toast';

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
const titleByTrainer: Record<string, string> = { words: 'Слова', verbs: 'Глаголы', articles: 'Артикли' };

export const UsersTab: React.FC = () => {
  const confirm = useConfirm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [progress, setProgress] = useState<LearnerProgressSnapshot | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await getAdminUsers()); }
    catch (error) { reportError(error, 'Не удалось загрузить пользователей'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    getAdminUsers().then((result) => { if (active) setUsers(result); })
      .catch((error) => { if (active) reportError(error, 'Не удалось загрузить пользователей'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => !query || user.telegramId.toLowerCase().includes(query));
  }, [users, search]);

  const perform = async (user: AdminUser, action: () => Promise<unknown>, success: string) => {
    setBusyId(user.id);
    try { await action(); showToast(success, 'success'); await load(); }
    catch (error) { reportError(error, 'Не удалось изменить пользователя'); }
    finally { setBusyId(null); }
  };

  const openProgress = async (user: AdminUser) => {
    setSelected(user);
    setProgress(null);
    setProgressLoading(true);
    try { setProgress(await getAdminUserProgress(user.id)); }
    catch (error) { reportError(error, 'Не удалось загрузить прогресс'); }
    finally { setProgressLoading(false); }
  };

  const actions = (user: AdminUser) => {
    const busy = busyId === user.id;
    return <div className="user-admin-actions">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void openProgress(user)}><Eye size={15} /> Прогресс</button>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void perform(user, () => setUserAdmin(user.id, !user.isAdmin), user.isAdmin ? 'Права администратора сняты' : 'Права администратора выданы')}>
        {user.isAdmin ? <ShieldOff size={15} /> : <Shield size={15} />}{user.isAdmin ? 'Снять админку' : 'Выдать админку'}
      </button>
      <button type="button" className="btn-secondary" disabled={busy || user.isAdmin} onClick={() => void perform(user, () => setUserBanned(user.id, !user.isBanned), user.isBanned ? 'Пользователь разблокирован' : 'Пользователь заблокирован')}>
        <UserRoundX size={15} />{user.isBanned ? 'Разблокировать' : 'Заблокировать'}
      </button>
      <button type="button" className="btn-secondary" disabled={busy || !user.hasProgress} onClick={async () => {
        if (await confirm(`Сбросить прогресс пользователя Telegram ID ${user.telegramId}? Это удалит карточки SRS, настройки и счёт.`, { title: 'Сбросить прогресс', confirmLabel: 'Сбросить', danger: true })) {
          await perform(user, () => resetUserProgress(user.id), 'Прогресс пользователя сброшен');
        }
      }}><RotateCcw size={15} /> Сбросить прогресс</button>
      <button type="button" className="btn-secondary btn-danger-text" disabled={busy} onClick={async () => {
        if (await confirm(`Удалить аккаунт Telegram ID ${user.telegramId}? Его сессии и прогресс будут удалены.`, { title: 'Удалить пользователя', confirmLabel: 'Удалить', danger: true })) {
          await perform(user, () => deleteAdminUser(user.id), 'Пользователь удалён');
        }
      }}><Trash2 size={15} /> Удалить</button>
      {busy && <LoaderCircle className="spin" size={16} aria-label="Выполняется действие" />}
    </div>;
  };

  const data = progress?.data;
  const srsRows = Object.entries(data?.srs ?? {}).map(([trainer, cards]) => ({ trainer, count: Object.keys(cards ?? {}).length }));
  const scores = Object.entries(data?.scores ?? {});

  return <div className="users-admin">
    <div className="users-admin-toolbar">
      <label className="users-admin-search"><Search size={16} /><span className="visually-hidden">Поиск по Telegram ID</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по Telegram ID" /></label>
      <span className="users-admin-count">Всего: {users.length}</span>
      <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? 'Загрузка…' : 'Обновить'}</button>
    </div>
    {loading && users.length === 0 ? <div className="centered-message">Загрузка пользователей…</div> : filteredUsers.length === 0
      ? <div className="users-admin-empty">{users.length ? 'Пользователи не найдены.' : 'Пользователей пока нет.'}</div>
      : <div className="users-table-scroll" role="region" aria-label="Список пользователей" tabIndex={0}>
        <table className="users-table">
          <caption className="visually-hidden">Управление Telegram-пользователями</caption>
          <thead><tr><th scope="col">Telegram ID</th><th scope="col">Статус</th><th scope="col">Регистрация</th><th scope="col">Прогресс обновлён</th><th scope="col">Действия</th></tr></thead>
          <tbody>{filteredUsers.map((user) => <tr key={user.id}>
            <th scope="row" data-label="Telegram ID">{user.telegramId}</th>
            <td data-label="Статус"><span className={user.isBanned ? 'user-status user-status-banned' : user.isAdmin ? 'user-status user-status-admin' : 'user-status'}>{user.isBanned ? 'Заблокирован' : user.isAdmin ? 'Администратор' : 'Ученик'}</span></td>
            <td data-label="Регистрация">{dateTime(user.createdAt)}</td>
            <td data-label="Прогресс обновлён">{dateTime(user.progressUpdatedAt)}</td>
            <td data-label="Действия">{actions(user)}</td>
          </tr>)}</tbody>
        </table>
      </div>}

    {selected && <Modal title={`Прогресс · Telegram ID ${selected.telegramId}`} onClose={() => setSelected(null)} size="lg">
      <div className="modal-body user-progress">
        {progressLoading ? <p>Загрузка прогресса…</p> : !progress?.data ? <p>Сохранённого прогресса пока нет.</p> : <>
          <p className="user-progress-updated">Последнее обновление: {dateTime(progress.updatedAt)} · ревизия {progress.revision}</p>
          <h4>Карточки SRS</h4>
          {srsRows.length ? <ul>{srsRows.map(({ trainer, count }) => <li key={trainer}>{titleByTrainer[trainer] ?? trainer}: {count}</li>)}</ul> : <p>Карточек пока нет.</p>}
          <h4>Счёт по тренажёрам</h4>
          {scores.length ? <ul>{scores.map(([trainer, score]) => <li key={trainer}>{titleByTrainer[trainer] ?? trainer}: {score.correct ?? 0} из {score.total ?? 0}, серия {score.streak ?? 0}, рекорд {score.bestStreak ?? 0}</li>)}</ul> : <p>Ответов пока нет.</p>}
          <h4>Настройки и активность</h4>
          <p>Цель на день: {data?.settings?.dailyGoal ?? '—'} · ответов сегодня: {data?.daily?.count ?? 0} {data?.daily?.day ? `(дата ${data.daily.day})` : ''}</p>
          <p>Обучение пройдено: {data?.onboardingSeen ? 'да' : 'нет'}</p>
        </>}
      </div>
    </Modal>}
  </div>;
};
