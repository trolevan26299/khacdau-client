import { FormEvent, useState } from 'react';
import { Account, api } from '../api';
import { SealIcon } from './Brand';

interface Props {
  notice?: string;
  onLoggedIn: (account: Account) => void;
}

export function Login({ notice, onLoggedIn }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      onLoggedIn(await api.login(username.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-hero">
          <span className="login-seal">
            <SealIcon size={56} />
          </span>
          <div className="login-brand">Khắc Dấu Tâm Tín</div>
          <div className="login-tagline">Tra mã số thuế · In đơn đề nghị khắc dấu</div>
        </div>

        <form className="card login-card" onSubmit={submit}>
          <div>
            <h1 className="login-title">Đăng nhập</h1>
            <p className="muted small">Dành cho đại lý gửi đơn đề nghị khắc dấu về Tâm Tín</p>
          </div>

          {notice && <div className="alert alert-warn">{notice}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>Tên đăng nhập</span>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-foot">Chưa có tài khoản? Liên hệ Tâm Tín để được cấp.</p>
      </div>
    </div>
  );
}
