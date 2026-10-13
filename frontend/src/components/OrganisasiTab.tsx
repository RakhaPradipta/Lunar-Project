import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Edit, Trash2, Users, TreePine, X, Search, Building2, UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { organisasiApi } from '../api/organisasiApi';
import type { Organisasi, UserAkun } from '../types/desawisata';

interface ToastItem {
  message: string;
  type: 'success' | 'error';
}

export default function OrganisasiTab() {
  const [organisasiList, setOrganisasiList] = useState<Organisasi[]>([]);
  const [userList, setUserList] = useState<UserAkun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organisasi | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Form organisasi
  const [orgForm, setOrgForm] = useState({
    namaOrganisasi: '',
    deskripsi: '',
    kontak: '',
    email: '',
    adminEmail: '',
    adminPassword: '',
    adminNama: '',
  });
  // Form user
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    namaLengkap: '',
    role: 'Admin',
    organisasiId: '' as string | number,
  });

  const addToast = (message: string, type: 'success' | 'error') => {
    setToasts((prev) => [...prev, { message, type }]);
    setTimeout(() => setToasts((prev) => prev.slice(1)), 3500);
  };

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [orgRes, userRes] = await Promise.all([
        organisasiApi.getAll(),
        organisasiApi.getUsers(),
      ]);
      if (orgRes.success) setOrganisasiList(orgRes.data);
      if (userRes.success) setUserList(userRes.data);
    } catch (err) {
      if (!silent) addToast(err instanceof Error ? err.message : 'Gagal memuat data organisasi', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditingOrg(null);
    setOrgForm({ namaOrganisasi: '', deskripsi: '', kontak: '', email: '', adminEmail: '', adminPassword: '', adminNama: '' });
    setShowCreateModal(true);
  };

  const openEdit = (org: Organisasi) => {
    setEditingOrg(org);
    setOrgForm({
      namaOrganisasi: org.namaOrganisasi,
      deskripsi: org.deskripsi,
      kontak: org.kontak,
      email: org.email,
      adminEmail: '',
      adminPassword: '',
      adminNama: '',
    });
    setShowCreateModal(true);
  };

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOrg) {
        await organisasiApi.update(editingOrg.id, {
          namaOrganisasi: orgForm.namaOrganisasi,
          deskripsi: orgForm.deskripsi,
          kontak: orgForm.kontak,
          email: orgForm.email,
        });
        addToast('Organisasi berhasil diperbarui!', 'success');
      } else {
        await organisasiApi.create({
          namaOrganisasi: orgForm.namaOrganisasi,
          deskripsi: orgForm.deskripsi,
          kontak: orgForm.kontak,
          email: orgForm.email,
          adminEmail: orgForm.adminEmail || undefined,
          adminPassword: orgForm.adminPassword || undefined,
          adminNama: orgForm.adminNama || undefined,
        });
        addToast('Organisasi berhasil dibuat!', 'success');
      }
      setShowCreateModal(false);
      loadData(true);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan organisasi', 'error');
    }
  };

  const handleOrgDelete = async (org: Organisasi) => {
    if (!confirm(`Yakin ingin menghapus organisasi "${org.namaOrganisasi}"?`)) return;
    try {
      await organisasiApi.delete(org.id);
      addToast('Organisasi dihapus', 'success');
      loadData(true);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus organisasi', 'error');
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await organisasiApi.createUser({
        email: userForm.email,
        password: userForm.password,
        namaLengkap: userForm.namaLengkap,
        role: userForm.role,
        organisasiId: userForm.role === 'Admin' ? Number(userForm.organisasiId) || null : null,
      });
      addToast('User berhasil dibuat!', 'success');
      setShowUserModal(false);
      setUserForm({ email: '', password: '', namaLengkap: '', role: 'Admin', organisasiId: '' });
      loadData(true);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat user', 'error');
    }
  };

  const handleUserDelete = async (user: UserAkun) => {
    if (!confirm(`Yakin ingin menghapus user "${user.email}"?`)) return;
    try {
      await organisasiApi.deleteUser(user.id);
      addToast('User dihapus', 'success');
      loadData(true);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus user', 'error');
    }
  };

  const filtered = organisasiList.filter((o) =>
    !search || o.namaOrganisasi.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">🏢 Manajemen Organisasi</h1>
          <p className="admin-page-subtitle">
            Kelola tenant (organisasi) beserta akun adminnya. Setiap admin hanya mengelola desa milik organisasinya.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link
            to="/register-admin"
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Buka halaman register khusus pembuatan akun Admin Organisasi"
          >
            <UserPlus size={16} />
            Register Admin
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(true)}>
            <Users size={16} />
            Tambah User
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={16} />
            Tambah Organisasi
          </button>
        </div>
      </div>

      {/* Daftar organisasi */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-header-left">
            <h2>Daftar Organisasi</h2>
          </div>
          <div className="table-search">
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Cari organisasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Organisasi</th>
                <th>Kontak</th>
                <th>Desa</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr key={org.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--green-600), var(--green-800))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Building2 size={18} color="white" />
                      </div>
                      <div>
                        <strong>{org.namaOrganisasi}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{org.email || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{org.kontak || '-'}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                      <TreePine size={15} color="var(--green-700)" /> {org.jumlahDesa}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                      <Users size={15} color="#3b82f6" /> {org.jumlahAdmin}
                    </span>
                  </td>
                  <td>
                    <span className={`table-badge ${org.aktif ? 'active' : 'inactive'}`}>
                      {org.aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="edit" title="Edit" onClick={() => openEdit(org)}>
                        <Edit size={16} />
                      </button>
                      <button className="delete" title="Hapus" onClick={() => handleOrgDelete(org)} disabled={org.id === 1}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Belum ada organisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Daftar user admin */}
      <div className="table-container" style={{ marginTop: 24 }}>
        <div className="table-header">
          <div className="table-header-left">
            <h2>Akun Admin</h2>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nama</th>
              <th>Role</th>
              <th>Organisasi</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.email}</strong></td>
                <td>{u.namaLengkap || '-'}</td>
                <td>
                  <span className={`table-badge ${u.role === 'SuperAdmin' ? 'category' : 'active'}`}>
                    {u.role === 'SuperAdmin' ? '👑 Super Admin' : '🏢 Admin Organisasi'}
                  </span>
                </td>
                <td>{u.organisasiNama || '-'}</td>
                <td>
                  <span className={`table-badge ${u.aktif ? 'active' : 'inactive'}`}>
                    {u.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="delete"
                      title="Hapus user"
                      onClick={() => handleUserDelete(u)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {userList.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  Belum ada user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t, i) => (
          <div
            key={i}
            style={{
              padding: '10px 16px', borderRadius: 10, fontWeight: 600, fontSize: '0.85rem',
              background: t.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${t.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: t.type === 'success' ? '#166534' : '#b91c1c',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Modal create/edit organisasi */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Globe size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                {editingOrg ? '✏️ Edit Organisasi' : '➕ Tambah Organisasi'}
              </h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleOrgSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Nama Organisasi *</label>
                    <input
                      type="text" required placeholder="mis. Dinas Pariwisata Kabupaten Batu"
                      value={orgForm.namaOrganisasi}
                      onChange={(e) => setOrgForm({ ...orgForm, namaOrganisasi: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Deskripsi</label>
                    <textarea
                      placeholder="Deskripsi singkat organisasi..."
                      value={orgForm.deskripsi}
                      onChange={(e) => setOrgForm({ ...orgForm, deskripsi: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Kontak</label>
                    <input
                      type="text" placeholder="No. telp / WhatsApp"
                      value={orgForm.kontak}
                      onChange={(e) => setOrgForm({ ...orgForm, kontak: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email" placeholder="email@organisasi.go.id"
                      value={orgForm.email}
                      onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                    />
                  </div>

                  {!editingOrg && (
                    <>
                      <div className="form-group full-width" style={{
                        marginTop: 8, padding: '12px 14px', background: '#f0fdf4',
                        border: '1px solid #bbf7d0', borderRadius: 10,
                      }}>
                        <label style={{ fontWeight: 700, color: '#166534' }}>
                          👤 Akun Admin Pertama (opsional)
                        </label>
                        <small style={{ color: '#64748b', display: 'block', marginBottom: 10 }}>
                          Jika diisi, sistem otomatis membuat akun admin untuk organisasi ini.
                          Admin hanya bisa mengelola desa milik organisasinya.
                        </small>
                      </div>
                      <div className="form-group full-width">
                        <label>Email Admin</label>
                        <input
                          type="email" placeholder="admin@organisasi.go.id"
                          value={orgForm.adminEmail}
                          onChange={(e) => setOrgForm({ ...orgForm, adminEmail: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Nama Admin</label>
                        <input
                          type="text" placeholder="Nama lengkap admin"
                          value={orgForm.adminNama}
                          onChange={(e) => setOrgForm({ ...orgForm, adminNama: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Password Admin</label>
                        <input
                          type="password" placeholder="Min. 6 karakter"
                          value={orgForm.adminPassword}
                          onChange={(e) => setOrgForm({ ...orgForm, adminPassword: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingOrg ? 'Simpan Perubahan' : 'Buat Organisasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal create user */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👤 Tambah Akun Admin</h2>
              <button className="modal-close" onClick={() => setShowUserModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Email *</label>
                    <input
                      type="email" required placeholder="admin@organisasi.go.id"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Nama Lengkap</label>
                    <input
                      type="text" placeholder="Nama lengkap"
                      value={userForm.namaLengkap}
                      onChange={(e) => setUserForm({ ...userForm, namaLengkap: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Role *</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    >
                      <option value="Admin">Admin Organisasi</option>
                      <option value="SuperAdmin">Super Admin</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password" required minLength={6} placeholder="Min. 6 karakter"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>
                  {userForm.role === 'Admin' && (
                    <div className="form-group full-width">
                      <label>Organisasi *</label>
                      <select
                        required
                        value={userForm.organisasiId}
                        onChange={(e) => setUserForm({ ...userForm, organisasiId: e.target.value })}
                      >
                        <option value="">-- Pilih organisasi --</option>
                        {organisasiList.map((o) => (
                          <option key={o.id} value={o.id}>{o.namaOrganisasi}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary btn-sm">Buat User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
