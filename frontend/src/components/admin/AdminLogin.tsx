import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { getErrorMessage, login } from '../../api/client';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);

    try {
      await login(password);
      onLogin();
    } catch (e) {
      setLoginError(getErrorMessage(e, 'Ошибка подключения к серверу'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card login-card">
      <div className="login-title">
        <Lock size={26} color="var(--accent-primary)" aria-hidden="true" />
        <h2>Вход в панель управления</h2>
      </div>
      <p className="login-lead">Доступ к управлению базой слов, категорий и аналитикой.</p>

      <form onSubmit={handleLogin}>
        <div className="login-field">
          <label className="sr-only" htmlFor="admin-password-input">Пароль администратора</label>
          <input
            id="admin-password-input"
            type="password"
            className="text-input w-full"
            placeholder="Пароль администратора"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {loginError && (
          <div className="form-error" role="alert">
            <AlertCircle size={16} /> {loginError}
          </div>
        )}

        <button id="admin-login-submit-btn" type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
          Войти
        </button>
      </form>
    </div>
  );
};
