import { useEffect, useState } from 'react';
import { Account, api, hasToken, logout, setUnauthorizedHandler } from './api';
import { Login } from './components/Login';
import { LookupPage } from './components/LookupPage';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(hasToken());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccount(null);
      setNotice('Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa, vui lòng đăng nhập lại');
    });
    if (!hasToken()) return;
    api
      .me()
      .then(setAccount)
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!account) {
    return (
      <Login
        notice={notice}
        onLoggedIn={acc => {
          setNotice('');
          setAccount(acc);
        }}
      />
    );
  }

  return (
    <LookupPage
      account={account}
      onLogout={() => {
        logout();
        setAccount(null);
      }}
    />
  );
}
