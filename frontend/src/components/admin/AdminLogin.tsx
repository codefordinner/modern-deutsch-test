import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        onLogin(data.token);
      } else {
        setLoginError(data.error || 'Неверный пароль администратора');
      }
    } catch {
      setLoginError('Ошибка подключения к серверу');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 440, margin: '40px auto', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
        <Lock size={26} color="var(--accent-primary)" />
        <h2 style={{ margin: 0 }}>Вход в панель управления</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
        Доступ к управлению базой слов, категорий и аналитикой.
      </p>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <input
            id="admin-password-input"
            type="password"
            className="text-input"
            style={{ width: '100%' }}
            placeholder="Пароль администратора"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        {loginError && (
          <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={16} /> {loginError}
          </div>
        )}

        <button id="admin-login-submit-btn" type="submit" className="btn-primary" style={{ width: '100%' }}>
          Войти
        </button>
      </form>
    </div>
  );
};
