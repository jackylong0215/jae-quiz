import { LocalizedAttributes } from './i18n.jsx';
import { LocalizedText, useLocale, t } from './i18n.jsx';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api as axios } from './i18n-api.js';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  `http://${window.location.hostname}:8000`;

const smallBtnStyle = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  borderRadius: 6,
  cursor: 'pointer',
  color: '#334155',
};

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16,
};

const modalCardStyle = {
  background: '#ffffff',
  borderRadius: 14,
  padding: 24,
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 6,
  marginTop: 12,
};

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1.5px solid #cbd5e1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimaryStyle = {
  padding: '9px 20px',
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondaryStyle = {
  padding: '9px 20px',
  background: '#f1f5f9',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
};

export default function AdminPage() {
  useLocale();
      const [editUser, setEditUser] = useState(null);       // 編輯中的用戶
  const [editForm, setEditForm] = useState({});         // 編輯表單資料
  const [pwUser, setPwUser] = useState(null);           // 重設密碼的用戶
  const [newPw, setNewPw] = useState('');               // 新密碼
  const [showPw, setShowPw] = useState(false);          // 顯示/隱藏密碼
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const token = localStorage.getItem('jae_token');
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 打開編輯 Modal
  const openEditModal = (u) => {
    setEditUser(u);
    setEditForm({
      email: u.email,
      full_name: u.full_name || '',
      is_admin: u.is_admin,
    });
    setActionMsg('');
  };

  // 打開重設密碼 Modal
  const openPasswordModal = (u) => {
    setPwUser(u);
    setNewPw('');
    setShowPw(false);
    setActionMsg('');
  };

  // 儲存編輯
const handleSaveEdit = async () => {
  setActionLoading(true);
  setActionMsg('');
  try {
    await axios.patch(
      `${API_BASE_URL}/admin/users/${editUser.id}`,
      editForm,
      { headers: authHeaders }
    );

    // 本地立即更新 state，表格會立刻刷新
    setUsers(prev =>
      prev.map(u =>
        u.id === editUser.id
          ? { ...u, email: editForm.email, full_name: editForm.full_name, is_admin: editForm.is_admin }
          : u
      )
    );

    setEditUser(null);
  } catch (err) {
    setActionMsg(err.response?.data?.detail || '儲存失敗');
  } finally {
    setActionLoading(false);
  }
};

  // 重設密碼
  const handleResetPassword = async () => {
    if (newPw.length < 6) {
      setActionMsg('密碼至少 6 位');
      return;
    }
    setActionLoading(true);
    setActionMsg('');
    try {
      await axios.post(
        `${API_BASE_URL}/admin/users/${pwUser.id}/reset-password`,
        { new_password: newPw },
        { headers: authHeaders }
      );
      setPwUser(null);
      alert(t('✅ 密碼已重設成功'));
    } catch (err) {
      setActionMsg(err.response?.data?.detail || '重設失敗');
    } finally {
      setActionLoading(false);
    }
  };

  // 刪除用戶
  const handleDelete = async (u) => {
    if (!window.confirm(`確定刪除用戶「${u.username}」？此操作無法復原。`)) return;
    try {
      await axios.delete(
        `${API_BASE_URL}/admin/users/${u.id}`,
        { headers: authHeaders }
      );
      setUsers(users.filter(x => x.id !== u.id));
    } catch (err) {
      alert(t(err.response?.data?.detail || '刪除失敗'));
    }
  };
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jae_token');
    const user = JSON.parse(localStorage.getItem('jae_user') || 'null');

    if (!token || !user?.is_admin) {
      navigate('/');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API_BASE_URL}/admin/stats`, { headers }).catch(() => ({ data: null })),
      axios.get(`${API_BASE_URL}/admin/users`, { headers }).catch(() => ({ data: [] })),
    ])
      .then(([s, u]) => {
        setStats(s.data);
        setUsers(u.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '無法載入管理資料');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) return <div style={{ padding: 40 }}><LocalizedText value="載入中..." /></div>;
  if (error) return <div style={{ padding: 40, color: '#b91c1c' }}>⚠️ <LocalizedText value={error} /></div>;

  return (
    
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1><LocalizedText value="👑 管理員後台" /></h1>
        <button
          onClick={() => navigate('/browse')}
          style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
        ><LocalizedText value="← 返回題庫" /></button>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, color: '#64748b' }}><LocalizedText value={k} /></div>
              <div style={{ fontSize: 24, fontWeight: 700 }}><LocalizedText value={v} /></div>
            </div>
          ))}
        </div>
      )}

            <h3><LocalizedText value="👥 用戶列表（" /><LocalizedText value={users.length} />）</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
  <tr style={{ background: '#f1f5f9' }}>
    <th style={{ padding: 10, textAlign: 'left' }}>ID</th>
    <th style={{ padding: 10, textAlign: 'left' }}><LocalizedText value="用戶名" /></th>
    <th style={{ padding: 10, textAlign: 'left' }}><LocalizedText value="姓名" /></th>
    <th style={{ padding: 10, textAlign: 'left' }}><LocalizedText value="郵箱" /></th>
    <th style={{ padding: 10, textAlign: 'left' }}><LocalizedText value="身份" /></th>
    <th style={{ padding: 10, textAlign: 'left' }}><LocalizedText value="操作" /></th>
  </tr>
</thead>
<tbody>
  {users.map((u) => (
    <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
      <td style={{ padding: 10 }}><LocalizedText value={u.id} /></td>
      <td style={{ padding: 10 }}><LocalizedText value={u.username} /></td>
      <td style={{ padding: 10 }}><LocalizedText value={u.full_name || '-'} /></td>
      <td style={{ padding: 10 }}><LocalizedText value={u.email} /></td>
      <td style={{ padding: 10 }}><LocalizedText value={u.is_admin ? '👑 管理員' : '🎓 考生'} /></td>
      <td style={{ padding: 10 }}>
                <button
                  onClick={() => openEditModal(u)}
                  style={smallBtnStyle}
                ><LocalizedText value="✏️ 編輯" /></button>
                <button
                  onClick={() => openPasswordModal(u)}
                  style={{ ...smallBtnStyle, marginLeft: 6 }}
                ><LocalizedText value="🔑 重設密碼" /></button>
                <button
                  onClick={() => handleDelete(u)}
                  style={{ ...smallBtnStyle, marginLeft: 6, color: '#b91c1c', borderColor: '#fca5a5' }}
                ><LocalizedText value="🗑️ 刪除" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
            {/* ===== 編輯用戶 Modal ===== */}
      {editUser && (
        <div style={modalOverlayStyle} onClick={() => setEditUser(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}><LocalizedText value="✏️ 編輯用戶：" /><LocalizedText value={editUser.username} /></h3>

            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={editForm.email || ''}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              style={inputStyle}
            />

            <label style={labelStyle}><LocalizedText value="姓名 / 稱呼" /></label>
            <input
              type="text"
              value={editForm.full_name || ''}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              style={inputStyle}
            />

            <label style={{ ...labelStyle, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={!!editForm.is_admin}
                onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                style={{ marginRight: 8 }}
                disabled={editUser.id === /* 當前管理員 ID */ undefined}
              /><LocalizedText value="設為管理員" /></label>

            {actionMsg && <div style={{ color: '#b91c1c', marginTop: 8 }}>⚠️ <LocalizedText value={actionMsg} /></div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditUser(null)} style={btnSecondaryStyle}><LocalizedText value="取消" /></button>
              <button onClick={handleSaveEdit} disabled={actionLoading} style={btnPrimaryStyle}>
                <LocalizedText value={actionLoading ? '儲存中...' : '儲存'} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 重設密碼 Modal ===== */}
      {pwUser && (
        <div style={modalOverlayStyle} onClick={() => setPwUser(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}><LocalizedText value="🔑 重設密碼：" /><LocalizedText value={pwUser.username} /></h3>
            <p style={{ color: '#64748b', fontSize: 13 }}><LocalizedText value="請輸入新密碼（至少 6 位），儲存後該用戶即可用新密碼登入。" /></p>

            <label style={labelStyle}><LocalizedText value="新密碼" /></label>
            <div style={{ position: 'relative' }}>
              <LocalizedAttributes><input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
                placeholder={"輸入新密碼"}
              /></LocalizedAttributes>
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                <LocalizedText value={showPw ? '🙈' : '👁️'} />
              </button>
            </div>

            {actionMsg && <div style={{ color: '#b91c1c', marginTop: 8 }}>⚠️ <LocalizedText value={actionMsg} /></div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setPwUser(null)} style={btnSecondaryStyle}><LocalizedText value="取消" /></button>
              <button onClick={handleResetPassword} disabled={actionLoading} style={btnPrimaryStyle}>
                <LocalizedText value={actionLoading ? '重設中...' : '確認重設'} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
