# 📋 Laporan E2E Testing Multi-Tenant — DesaWisata API

**Tanggal:** 11 September 2026 · **Target:** `http://localhost:5200/api` · **DB:** SQLite `desawisata.db`
**Metode:** Black-box HTTP testing via `docs/e2e-multitenant.sh` (idempotent, bisa diulang)
**Hasil akhir:** ✅ **19 PASS / 0 FAIL** (re-run 16 September 2026; termasuk 2 test baru utk 403 transfer eksplisit)

---

## 1. Ringkasan Arsitektur Multi-Tenant

| Komponen | Implementasi |
|---|---|
| Model tenancy | **Single database, shared schema**, kolom diskriminator `OrganisasiId` |
| Entity tenant | `Organisasi` (mis. dinas pariwisata kabupaten/kota) |
| Isolasi data | `DesaWisata.OrganisasiId` (FK, `Restrict`); `Pengunjung`/`Pemesanan` ter-scope via desa |
| Identitas | JWT claim `organisasiId` → `CurrentAdmin.IsSuperAdmin` |
| Role | `SuperAdmin` (lintas tenant, `OrganisasiId = null`) vs `Admin` (terikat 1 organisasi) |
| Provisioning | `POST /api/Organisasi` (SuperAdmin only), bisa sekalian buat admin pertama |
| Enforcement | Manual per-endpoint (`.Where(d => d.OrganisasiId == admin.OrganisasiId)`) — **tanpa** EF global query filter |

## 2. Parameter Khusus Multi-Tenant yang Diuji

| # | Parameter/Skenario | Endpoint | Ekspektasi |
|---|---|---|---|
| 1 | Login 3 aktor (SuperAdmin, Admin org-1, Admin org-B) | `POST /Auth/login` | JWT berisi role + `organisasiId` |
| 2 | Provisioning tenant B + admin B oleh SuperAdmin | `POST /Organisasi` | orgId baru, admin ter-bind |
| 3 | `POST /DesaWisata` tanpa/korup `organisasiId` oleh Admin | `POST /DesaWisata` | Server **memaksa** orgId dari token |
| 4 | Listing ter-scope `?mine=true` | `GET /DesaWisata?mine=true` | 0 desa milik tenant lain |
| 5 | Cross-tenant write (PUT/DELETE) | `PUT/DELETE /DesaWisata/{id}` | **403** |
| 6 | Percobaan transfer desa antar-organisasi oleh Admin | `PUT /DesaWisata/{id}` body `organisasiId:1` | orgId **diabaikan**, desa tetap |
| 7 | RBAC organisasi | `POST/GET /Organisasi(/1)` | 403 (Admin) / 401 (anon) |
| 8 | Booking lintas tenant | `GET /DesaWisata/{id}/pemesanan` | 403 untuk tenant lain, 200 + data untuk pemilik |
| 9 | Feed pengunjung lintas tenant | `GET /DesaWisata/aktivitas?mine=true` | 0 baris dari desa tenant lain |

## 3. Hasil Testing

| Status | Skenario | Expected | Actual | Catatan |
|---|---|---|---|---|
| ✅ | Auth: SuperAdmin login | `SuperAdmin` | `SuperAdmin` | seed account |
| ✅ | Auth: Admin org-1 login (orgId=1) | `1` | `1` | seed account |
| ✅ | TenantMgmt: SuperAdmin creates Org B (+admin B) | `true` | `true` | provisioning tenant |
| ✅ | Auth: Admin B login bound to org B | `3` | `3` | organisasiId dari JWT |
| ✅ | RBAC: Admin A denied creating organisasi | `403` | `403` | `Authorize(Roles=SuperAdmin)` |
| ✅ | Scoping: Admin A creates village → auto orgId=1 | `1` | `1` | client orgId diabaikan utk Admin |
| ✅ | Scoping: Admin B creates village → auto orgId=3 | `3` | `3` | tenant binding saat create |
| ✅ | Scoping: Admin A `?mine=true` has 0 foreign villages | `0` | `0` | total 27 desa |
| ✅ | Scoping: Admin B `?mine=true` has 0 foreign villages | `0` | `0` | tenant B view |
| ✅ | Isolation: Admin B cannot edit village of A (PUT) | `403` | `403` | cross-tenant write |
| ✅ | Isolation: Admin B cannot delete village of A | `403` | `403` | cross-tenant delete |
| ✅ | Sanity: Admin B CAN edit own village | `200` | `200` | write intra-tenant ok |
| ✅ | Isolation: village stays in org B after transfer attempt | `3` | `3` | orgId silently ignored for non-super |
| ✅ | RBAC: Admin B denied detail of org 1 (foreign) | `403` | `403` | tenant detail guard |
| ✅ | RBAC: Anonymous denied organisasi list | `401` | `401` | auth required |
| ✅ | Isolation: Admin B denied booking list of village A | `403` | `403` | cross-tenant read |
| ✅ | Sanity: Admin B sees booking of own village | `>=1` | `1` | positive visibility |
| ✅ | Isolation: Admin A visitor feed has 0 rows from village B | `0` | `0` | pengunjung scoped via desa |

### Data uji yang ter-generate di DB
- **Organisasi Id=3** — "Org B E2E" (`orgb@e2e.test`)
- **AdminUser** — `adminb@e2e.test` (Role `Admin`, `OrganisasiId=3`), password `bbb123`
- **DesaWisata Id=30** — "Desa A1 E2E" (`OrganisasiId=1`), **Id=31** — "Desa B1 E2E" (`OrganisasiId=3`)
- **Pemesanan Id=4** — booking "Turis E2E" di desa 31 (`B-031-20260911-0001`, status Tertunda)

## 4. Temuan & Catatan Keamanan

1. ✅ **Tidak ada kebocoran lintas tenant** pada seluruh endpoint yang diuji (read, write, delete, list, booking, feed pengunjung).
2. ✅ **Client tidak bisa spoof tenant**: `organisasiId` di body request selalu ditimpa nilai dari JWT untuk role Admin.
3. ✅ **[FIXED 2026-09-16]** Transfer desa kini **403 eksplisit** untuk Admin non-super (sebelumnya diabaikan diam-diam).
4. ⚠️ **Scoping manual per-endpoint** — satu endpoint baru yang lupa `.Where(OrganisasiId)` akan bocor. Rekomendasi: EF Core `HasQueryFilter` global.
5. ✅ **[FIXED 2026-09-16]** Tabel legacy yang benar-benar basi adalah **`AdminUser` (tunggal, kosong)** — laporan awal salah arah: tabel aktif justru **`AdminUsers` (plural)** karena EF Core memetakan tabel dari nama DbSet, berisi 4 akun admin asli. `Program.cs` kini DROP idempoten tabel tunggal saat startup; jangan pernah drop `AdminUsers`.
6. ⚠️ Semua seed desa masih milik org-1; multi-tenancy baru "hidup" setelah SuperAdmin membuat organisasi tambahan (sudah dibuktikan di test ini).

## 5. Skema Database Ter-generate (hasil akhir setelah testing)

> Diekstrak langsung dari `desawisata.db` via `sqlite_master` — lihat file lengkap: `docs/schema-generated.sql`

```sql
CREATE TABLE "Organisasi" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Organisasi" PRIMARY KEY AUTOINCREMENT,
    "NamaOrganisasi" TEXT NOT NULL,
    "Deskripsi" TEXT NOT NULL DEFAULT '',
    "Kontak" TEXT NOT NULL DEFAULT '',
    "Email" TEXT NOT NULL DEFAULT '',
    "Aktif" INTEGER NOT NULL DEFAULT 1,
    "CreatedAt" TEXT NOT NULL
);

CREATE TABLE "AdminUser" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_AdminUser" PRIMARY KEY AUTOINCREMENT,
    "Email" TEXT NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "NamaLengkap" TEXT NOT NULL DEFAULT '',
    "Role" TEXT NOT NULL,                    -- "SuperAdmin" | "Admin"
    "OrganisasiId" INTEGER NULL,             -- NULL utk SuperAdmin; FK ke tenant
    "Aktif" INTEGER NOT NULL DEFAULT 1,
    "CreatedAt" TEXT NOT NULL,
    CONSTRAINT "FK_AdminUser_Organisasi_OrganisasiId"
        FOREIGN KEY ("OrganisasiId") REFERENCES "Organisasi" ("Id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "IX_AdminUser_Email" ON "AdminUser" ("Email");

CREATE TABLE "DesaWisata" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_DesaWisata" PRIMARY KEY AUTOINCREMENT,
    "NamaDesa" TEXT NOT NULL,
    "Kecamatan" TEXT NOT NULL,
    "Kabupaten" TEXT NOT NULL,
    "Provinsi" TEXT NOT NULL,
    "Deskripsi" TEXT NOT NULL,
    "Lokasi" TEXT NOT NULL,
    "UrlGambar" TEXT NOT NULL,
    "Rating" INTEGER NOT NULL,
    "JumlahWisatawan" INTEGER NOT NULL,
    "Kategori" TEXT NOT NULL,
    "Aktif" INTEGER NOT NULL,
    "Latitude" REAL NOT NULL,
    "Longitude" REAL NOT NULL,
    "BatasPengunjung" INTEGER NOT NULL,
    "PengunjungHariIni" INTEGER NOT NULL,
    "Overtourism" INTEGER NOT NULL,
    "ThresholdPeringatan" INTEGER NOT NULL,
    "AutoLockOvertourism" INTEGER NOT NULL,
    "PesanPeringatan" TEXT NOT NULL,
    "StatusOperasional" TEXT NOT NULL,
    "JamBuka" TEXT NOT NULL,
    "JamTutup" TEXT NOT NULL,
    "HariOperasional" TEXT NOT NULL,
    "KontakPengelola" TEXT NOT NULL,
    "EmailPengelola" TEXT NOT NULL,
    "SocialMedia" TEXT NOT NULL,
    "HargaTiketLokal" INTEGER NOT NULL,
    "HargaTiketMancanegara" INTEGER NOT NULL,
    "HargaParkirMotor" INTEGER NOT NULL,
    "HargaParkirMobil" INTEGER NOT NULL,
    "Fasilitas" TEXT NOT NULL,
    "CreatedAt" TEXT NOT NULL,
    "UpdatedAt" TEXT NOT NULL
    -- kolom hasil upgrade runtime (ALTER TABLE):
    , "UrlWebsite" TEXT NOT NULL DEFAULT ''
    , "UrlFoto" TEXT NOT NULL DEFAULT ''
    , "UrlVideo" TEXT NOT NULL DEFAULT ''
    , "OrganisasiId" INTEGER NOT NULL DEFAULT 1   -- ⭐ TENANT KEY
);
CREATE INDEX "IX_Pemesanan_DesaWisataId" ON "Pemesanan" ("DesaWisataId");
CREATE INDEX "IX_Pengunjung_DesaWisataId" ON "Pengunjung" ("DesaWisataId");

CREATE TABLE "Pemesanan" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pemesanan" PRIMARY KEY AUTOINCREMENT,
    "DesaWisataId" INTEGER NOT NULL,
    "NomorBooking" TEXT NOT NULL,
    "NamaWisatawan" TEXT NOT NULL,
    "KategoriTiket" TEXT NOT NULL,
    "TanggalBooking" TEXT NOT NULL,
    "TanggalKunjungan" TEXT NOT NULL,
    "UrlFoto" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "CheckInAt" TEXT NULL,
    "PengunjungId" INTEGER NULL,
    CONSTRAINT "FK_Pemesanan_DesaWisata_DesaWisataId"
        FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
);

CREATE TABLE "Pengunjung" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pengunjung" PRIMARY KEY AUTOINCREMENT,
    "DesaWisataId" INTEGER NOT NULL,
    "NomorKarcis" TEXT NOT NULL,
    "NamaWisatawan" TEXT NOT NULL,
    "KategoriTiket" TEXT NOT NULL,
    "CheckInAt" TEXT NOT NULL,
    "CheckOutAt" TEXT NULL,
    CONSTRAINT "FK_Pengunjung_DesaWisata_DesaWisataId"
        FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
);

-- Legacy (sudah DIHAPUS otomatis saat startup karena selalu kosong):
DROP TABLE IF EXISTS "AdminUser"; -- duplikat "AdminUsers" (tabel aktif = plural, sesuai DbSet)
```

### Diagram relasi (hasil testing)

```
┌─────────────┐ 1     * ┌──────────────────────────────┐ 1     * ┌─────────────┐
│ Organisasi  │─────────│ DesaWisata                   │─────────│ Pengunjung  │
│  (TENANT)   │         │  .OrganisasiId  ⭐ tenant key │         └─────────────┘
│ Id=1 pusat  │         └──────────────────────────────┘ 1     * ┌─────────────┐
│ Id=3 OrgB   │                  │ 1                            │ Pemesanan   │
└─────────────┘                  └──────────────────────────────└─────────────┘
       │ NULL (SuperAdmin) / orgId (Admin)
┌─────────────┐
│ AdminUser   │  Role: SuperAdmin | Admin
└─────────────┘
```

## 6. Cara Menjalankan Ulang

```bash
# API harus jalan di :5200
bash docs/e2e-multitenant.sh
```
Script idempotent — tenant B dari run sebelumnya dipakai ulang, bukan dibuat duplikat.

---
*Skrip uji: `docs/e2e-multitenant.sh` · Hasil mentah: `docs/e2e-results.md` · Skema: `docs/schema-generated.sql`*
