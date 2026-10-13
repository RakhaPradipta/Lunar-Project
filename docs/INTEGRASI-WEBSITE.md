# Panduan Integrasi Website Eksternal

Website pihak ketiga (portal wisata, aggregator, B2B partner) dapat terhubung ke API
DesaWisata ini dengan **tenant + API key yang digenerate otomatis**.

---

## 1. Cara kerja singkat

```
Website baru  --POST /api/Site/register-->  API
              <--{ organisasiBaru + API key }--   (sekali saja)
Website       --GET /api/Site/desa  (header X-Api-Key)-->  data desa tenant-nya saja
```

- **1 website = 1 tenant (Organisasi) = 1 API key.**
- Organisasi baru dibuat otomatis dengan nama `[Web] <NamaWebsite>`.
- Jika website milik organisasi yang sudah ada, kirim `organisasiId` saat register.
- **API key hanya ditampilkan SEKALI** saat dibuat/di-regenerate — server hanya menyimpan
  hash SHA256-nya, sehingga tidak mungkin dilihat kembali.

## 2. Registrasi (publik, tanpa login)

```bash
curl -X POST http://localhost:5200/api/Site/register \
  -H "Content-Type: application/json" \
  -d '{
    "namaWebsite": "Portal Wisata Nusantara",
    "urlWebsite": "https://portalwisata.com",
    "emailKontak": "info@portalwisata.com"
  }'
```

Response (simpan `apiKey` sekarang!):

```json
{
  "success": true,
  "data": {
    "clientId": 1,
    "namaWebsite": "Portal Wisata Nusantara",
    "organisasiId": 5,
    "organisasiNama": "[Web] Portal Wisata Nusantara",
    "apiKey": "dwk_KzV8_iMja-HEMyr4NfwQHygP-t9-kIhQAv2WGdQVu1E",
    "createdAt": "2026-09-14T05:07:27Z"
  }
}
```

Alternatif: SuperAdmin juga bisa mendaftarkan website dari **Admin Panel →
Website Terhubung → Daftarkan Website**.

## 3. Memakai API (header `X-Api-Key`)

| Endpoint | Keterangan |
|----------|------------|
| `GET /api/Site/me` | Validasi key + info tenant (jumlah desa) |
| `GET /api/Site/desa?kategori=&provinsi=&search=` | Daftar desa (scoped, hanya aktif) |
| `GET /api/Site/desa/{id}` | Detail 1 desa + galeri foto (scoped) |

```bash
curl http://localhost:5200/api/Site/desa \
  -H "X-Api-Key: dwk_xxxxxxxxxxxxxxxxxxxx"
```

**Scoping otomatis:** website hanya melihat desa milik organisasinya. Desa organisasi
lain mengembalikan `404`, bukan datanya. Response sudah ringkas dan aman untuk
konsumsi publik (termasuk status keramaian real-time & galeri foto).

Contoh kode (JavaScript):

```js
const API = "https://api.desawisata.example";
const KEY = "dwk_..."; // jangan hardcode di frontend publik! simpan di server/proxy

const res = await fetch(`${API}/api/Site/desa`, { headers: { "X-Api-Key": KEY } });
const { data } = await res.json();
```

> ⚠️ **Keamanan:** panggil API ini dari *server* website klien (BFF/proxy), bukan dari
> browser pengunjung, agar API key tidak bocor ke publik.

## 4. Manajemen (SuperAdmin, butuh login)

| Endpoint | Keterangan |
|----------|------------|
| `GET /api/Site/clients` | Daftar semua website + metrik pemakaian |
| `POST /api/Site/clients/{id}/regenerate` | Key baru; key lama langsung mati |
| `PUT /api/Site/clients/{id}/status` `{ "aktif": false }` | Suspend / aktifkan kembali |
| `DELETE /api/Site/clients/{id}` | Hapus klien (tenant tidak ikut terhapus) |

## 5. Error reference

| HTTP | Arti |
|------|------|
| 401 | `X-Api-Key` tidak ada / tidak dikenal |
| 403 | Key valid tapi dinonaktifkan oleh admin |
| 404 | Desa tidak ada di tenant website ini |
| 400 | Payload registrasi tidak valid |

## 6. Catatan teknis

- Key: 32 byte acak → base64url, prefiks `dwk_`, ~47 karakter.
- Tabel `ApiClients` dibuat otomatis saat startup (idempoten, aman untuk DB lama).
- Metrik `jumlahRequest` dan `lastUsedAt` ter-update pada setiap pemakaian key.
- Rate limiting & webhook belum termasuk — mudah ditambahkan di `SiteController`
  (satu tempat untuk semua validasi key: `ValidateKeyAsync`).
