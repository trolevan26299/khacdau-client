import { ReactNode, useEffect, useState } from 'react';
import { Account, api } from '../api';
import {
  AuthorizationInfo,
  DEFAULT_ID_ISSUED_BY,
  deriveLocality,
  downloadKhacDauDoc,
  OUR_COMPANY_NAME,
} from '../lib/khacDauDoc';
import { Brand } from './Brand';

const MAX_COMPANIES = 10;
const TAX_CODE_REGEX = /^\d{10}(-\d{3})?$/;
const DEFAULT_PLACE = 'TP Hồ Chí Minh';
const DEFAULT_ISSUED_BY = 'Sở tài chính TP Hồ Chí Minh';
const DEFAULT_POSITION = 'GIÁM ĐỐC';

interface CompanyRow {
  taxCode: string;
  loading: boolean;
  error?: string;
  status?: string;
  companyName: string;
  address: string;
  issueDate: string;
  issuedBy: string;
  place: string;
  representative: string;
  position: string;
}

const toDisplayDate = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseTaxCodes = (text: string) =>
  Array.from(new Set(text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)));

// Ghi nhớ thông tin ủy quyền đã nhập theo từng tài khoản (chỉ trên máy này)
const authKey = (accountId: string) => `khacdau_client_auth_${accountId}`;
const loadAuth = (account: Account): AuthorizationInfo => {
  try {
    const saved = localStorage.getItem(authKey(account.id));
    if (saved) return JSON.parse(saved);
  } catch {
    /* bỏ qua */
  }
  return {
    type: 'agent',
    name: account.displayName,
    address: account.address,
    phone: account.phone,
    idNumber: '',
    idIssueDate: '',
    idIssuedBy: DEFAULT_ID_ISSUED_BY,
  };
};

interface Props {
  account: Account;
  onLogout: () => void;
}

export function LookupPage({ account, onLogout }: Props) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [docDate, setDocDate] = useState(todayIso());
  const [auth, setAuth] = useState<AuthorizationInfo>(() => loadAuth(account));
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(authKey(account.id), JSON.stringify(auth));
    } catch {
      /* bỏ qua */
    }
  }, [account.id, auth]);

  const updateRow = (taxCode: string, patch: Partial<CompanyRow>) =>
    setRows(prev => prev.map(r => (r.taxCode === taxCode ? { ...r, ...patch } : r)));

  const setAuthField = (key: keyof AuthorizationInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAuth(a => ({ ...a, [key]: e.target.value }));

  const handleSearch = async () => {
    setMessage(null);
    const codes = parseTaxCodes(input);
    if (codes.length === 0) return setMessage({ type: 'error', text: 'Vui lòng nhập mã số thuế' });
    if (codes.length > MAX_COMPANIES) {
      return setMessage({ type: 'error', text: `Tối đa ${MAX_COMPANIES} công ty mỗi lần (đang nhập ${codes.length})` });
    }
    const invalid = codes.filter(c => !TAX_CODE_REGEX.test(c));
    if (invalid.length) return setMessage({ type: 'error', text: `Mã số thuế không hợp lệ: ${invalid.join(', ')}` });

    setSearching(true);
    setRows(
      codes.map(taxCode => ({
        taxCode,
        loading: true,
        companyName: '',
        address: '',
        issueDate: '',
        issuedBy: DEFAULT_ISSUED_BY,
        place: DEFAULT_PLACE,
        representative: '',
        position: DEFAULT_POSITION,
      })),
    );

    const results = await Promise.allSettled(
      codes.map(async taxCode => {
        try {
          const info = await api.lookup(taxCode);
          const locality = deriveLocality(info.address);
          updateRow(taxCode, {
            ...(locality || {}),
            loading: false,
            status: info.status,
            companyName: info.name || '',
            address: info.address || '',
            representative: info.representative || '',
            issueDate: toDisplayDate(info.establishedDate),
          });
        } catch (err) {
          updateRow(taxCode, {
            loading: false,
            error: err instanceof Error ? err.message : 'Không tra cứu được, vui lòng nhập tay',
          });
          throw err;
        }
      }),
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    setMessage(
      failed
        ? { type: 'error', text: `${failed}/${codes.length} mã số thuế không tra cứu được, bạn có thể nhập tay thông tin còn thiếu` }
        : { type: 'success', text: `Đã tra cứu ${codes.length} công ty. Kiểm tra lại thông tin rồi bấm Tải Word để in.` },
    );
    setSearching(false);
  };

  const docDateObj = () => {
    const [y, m, d] = docDate.split('-').map(Number);
    return y ? new Date(y, m - 1, d) : new Date();
  };

  const checkAuth = () => {
    if (!auth.name.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập Thông tin ủy quyền và nhận bàn giao (họ tên hoặc tên đại lý)' });
      document.getElementById('auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const download = (row: CompanyRow) => downloadKhacDauDoc({ ...row, docDate: docDateObj(), authorization: auth });

  const handleDownload = (row: CompanyRow) => {
    if (checkAuth()) download(row);
  };

  const ready = rows.filter(r => !r.loading && r.companyName);

  const handleDownloadAll = async () => {
    if (!checkAuth()) return;
    for (const row of ready) {
      download(row);
      // Giãn cách để trình duyệt không chặn tải nhiều file liên tiếp
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    if (ready.length > 1) {
      setMessage({ type: 'success', text: `Đã tải ${ready.length} file Word. Nếu trình duyệt hỏi, hãy chọn "Cho phép tải nhiều tệp".` });
    }
  };

  const codeCount = parseTaxCodes(input).length;

  return (
    <div className="page">
      <div className="hero">
        <header className="topbar">
          <Brand light />
          <div className="topbar-right">
            <span className="account-name" title={account.username}>
              {account.displayName}
            </span>
            <button className="btn btn-outline-light" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <div className="hero-text">
          <h1>Đơn đề nghị khắc dấu</h1>
          <p>
            Nhập mã số thuế → kiểm tra thông tin → tải file Word về in, ký và gửi về {OUR_COMPANY_NAME}.
          </p>
        </div>
      </div>

      <main className="container">
        <section className="card">
          <h2 className="card-title">
            <span className="step">1</span> Mã số thuế
          </h2>
          <label className="field">
            <span>Mỗi dòng 1 mã, hoặc cách nhau bằng dấu phẩy (tối đa {MAX_COMPANIES} công ty)</span>
            <textarea
              rows={4}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSearch();
              }}
              placeholder={'0319755936\n0402362264'}
              className="mono"
            />
          </label>
          <div className="row-end">
            <label className="field inline">
              <span>Ngày làm đơn</span>
              <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
            </label>
            <div className="spacer" />
            <span className={codeCount > MAX_COMPANIES ? 'text-error small' : 'muted small'}>
              {codeCount}/{MAX_COMPANIES} mã
            </span>
            <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? 'Đang tra cứu…' : 'Tra cứu'}
            </button>
          </div>
        </section>

        <section className="card" id="auth-card">
          <div className="card-head">
            <h2 className="card-title">
              <span className="step">2</span> Thông tin ủy quyền và nhận bàn giao
            </h2>
            <div className="segmented">
              <button className={auth.type === 'agent' ? 'active' : ''} onClick={() => setAuth(a => ({ ...a, type: 'agent' }))}>
                Đại lý
              </button>
              <button
                className={auth.type === 'individual' ? 'active' : ''}
                onClick={() => setAuth(a => ({ ...a, type: 'individual' }))}
              >
                Cá nhân (CCCD)
              </button>
            </div>
          </div>
          <div className="grid">
            <Field label={auth.type === 'individual' ? 'Họ và tên *' : 'Tên đại lý *'}>
              <input value={auth.name} onChange={setAuthField('name')} />
            </Field>
            {auth.type === 'individual' ? (
              <>
                <Field label="Số CCCD">
                  <input value={auth.idNumber} onChange={setAuthField('idNumber')} inputMode="numeric" />
                </Field>
                <Field label="Ngày cấp CCCD">
                  <input value={auth.idIssueDate} onChange={setAuthField('idIssueDate')} placeholder="VD: 03/10/2025" />
                </Field>
                <Field label="Nơi cấp">
                  <input value={auth.idIssuedBy} onChange={setAuthField('idIssuedBy')} />
                </Field>
              </>
            ) : (
              <Field label="Địa chỉ đại lý" wide>
                <input value={auth.address} onChange={setAuthField('address')} />
              </Field>
            )}
            <Field label="Số điện thoại liên hệ">
              <input value={auth.phone} onChange={setAuthField('phone')} inputMode="tel" />
            </Field>
          </div>
        </section>

        {message && <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>{message.text}</div>}

        {rows.length > 0 && (
          <div className="results-head">
            <h2 className="card-title">
              <span className="step">3</span> Kiểm tra và tải đơn
            </h2>
            <div className="actions">
              <button className="btn btn-ghost" onClick={() => setRows([])}>
                Xóa kết quả
              </button>
              <button className="btn btn-success" onClick={handleDownloadAll} disabled={ready.length === 0}>
                Tải tất cả ({ready.length})
              </button>
            </div>
          </div>
        )}

        {rows.map((row, idx) => (
          <section className="card company" key={row.taxCode}>
            <div className="card-head">
              <div className="company-title">
                <span className="badge-num">{idx + 1}</span>
                <span className="mono strong">{row.taxCode}</span>
                {row.loading && <span className="spinner small" />}
                {row.status && <span className="pill pill-ok">{row.status}</span>}
                {row.error && <span className="text-error small">{row.error}</span>}
              </div>
              <button className="btn btn-primary" onClick={() => handleDownload(row)} disabled={row.loading || !row.companyName}>
                Tải Word
              </button>
            </div>
            <div className="grid">
              <Field label="Tên doanh nghiệp" wide>
                <input value={row.companyName} disabled={row.loading} onChange={e => updateRow(row.taxCode, { companyName: e.target.value })} />
              </Field>
              <Field label="Địa chỉ trụ sở chính" wide>
                <input value={row.address} disabled={row.loading} onChange={e => updateRow(row.taxCode, { address: e.target.value })} />
              </Field>
              <Field label="Người đại diện theo pháp luật">
                <input
                  value={row.representative}
                  disabled={row.loading}
                  placeholder="Nhập tên nếu tra cứu không có"
                  onChange={e => updateRow(row.taxCode, { representative: e.target.value })}
                />
              </Field>
              <Field label="Chức vụ">
                <input value={row.position} disabled={row.loading} onChange={e => updateRow(row.taxCode, { position: e.target.value })} />
              </Field>
              <Field label="Ngày cấp / thành lập">
                <input
                  value={row.issueDate}
                  disabled={row.loading}
                  placeholder="VD: 20/10/2026"
                  onChange={e => updateRow(row.taxCode, { issueDate: e.target.value })}
                />
              </Field>
              <Field label="Cấp bởi">
                <input value={row.issuedBy} disabled={row.loading} onChange={e => updateRow(row.taxCode, { issuedBy: e.target.value })} />
              </Field>
              <Field label="Nơi làm đơn">
                <input value={row.place} disabled={row.loading} onChange={e => updateRow(row.taxCode, { place: e.target.value })} />
              </Field>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
