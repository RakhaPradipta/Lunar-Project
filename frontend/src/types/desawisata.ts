export interface DesaWisata {
  id: number;
  namaDesa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  deskripsi: string;
  lokasi: string;
  urlGambar: string;

  // Tautan eksternal (website resmi / galeri foto / video)
  urlWebsite: string;
  urlFoto: string;
  urlVideo: string;

  rating: number;
  jumlahWisatawan: number;
  kategori: string;
  aktif: boolean;
  latitude: number;
  longitude: number;

  // Overtourism per desa
  batasPengunjung: number;
  pengunjungHariIni: number;
  overtourism: boolean;
  thresholdPeringatan: number;
  autoLockOvertourism: boolean;
  pesanPeringatan: string;

  // Operational
  statusOperasional: string;
  jamBuka: string;
  jamTutup: string;
  hariOperasional: string;

  // Contact
  kontakPengelola: string;
  emailPengelola: string;
  socialMedia: string;

  // Pricing
  hargaTiketLokal: number;
  hargaTiketMancanegara: number;
  hargaParkirMotor: number;
  hargaParkirMobil: number;

  /** Pajak daerah (persen 0–100) berlaku di desa ini */
  persenPajakDaerah: number;

  // Facilities
  fasilitas: string;

  // Multi-tenant: organisasi pemilik desa
  organisasiId: number;
  organisasiNama: string;

  // Galeri foto (multi-foto per desa)
  galeriFoto: DesaFoto[];

  createdAt: string;
  updatedAt: string;
}

export interface DesaFoto {
  id: number;
  desaWisataId: number;
  url: string;
  judul: string;
  /** "foto" atau "video" (YouTube/TikTok/Instagram) */
  tipe: 'foto' | 'video' | string;
  urutan: number;
}

export interface DesaFotoRequest {
  url: string;
  judul?: string;
  tipe?: 'foto' | 'video' | string;
  urutan?: number;
}

export interface CreateDesaWisataRequest {
  namaDesa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  deskripsi: string;
  lokasi: string;
  urlGambar: string;

  // Tautan eksternal (website resmi / galeri foto / video)
  urlWebsite: string;
  urlFoto: string;
  urlVideo: string;

  rating: number;
  jumlahWisatawan: number;
  kategori: string;
  aktif: boolean;
  latitude: number;
  longitude: number;

  // Overtourism per desa
  batasPengunjung: number;
  pengunjungHariIni: number;
  overtourism: boolean;
  thresholdPeringatan: number;
  autoLockOvertourism: boolean;
  pesanPeringatan: string;

  // Operational
  statusOperasional: string;
  jamBuka: string;
  jamTutup: string;
  hariOperasional: string;

  // Contact
  kontakPengelola: string;
  emailPengelola: string;
  socialMedia: string;

  // Pricing
  hargaTiketLokal: number;
  hargaTiketMancanegara: number;
  hargaParkirMotor: number;
  hargaParkirMobil: number;

  /** Pajak daerah (persen 0–100) */
  persenPajakDaerah?: number;

  // Facilities
  fasilitas: string;

  // Multi-tenant: hanya dipakai SuperAdmin (Admin otomatis di-set ke organisasinya)
  organisasiId?: number;
}

/** Satu hari prakiraan keramaian desa */
export interface ForecastHari {
  tanggal: string; // yyyy-MM-dd
  hari: string;
  persen: number;
  status: 'Lengang' | 'Sedang' | 'Ramai' | 'Penuh' | string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  totalData: number;
}

export interface Pengunjung {
  id: number;
  desaWisataId: number;
  nomorKarcis: string;
  namaWisatawan: string;
  kategoriTiket: string; // 'Lokal' | 'Mancanegara'
  checkInAt: string;
  checkOutAt?: string | null;
}

export interface VisitorActionResponse {
  desa: DesaWisata;
  pengunjung: Pengunjung;
}

export interface VisitorActivity {
  id: number;
  desaWisataId: number;
  namaDesa: string;
  nomorKarcis: string;
  namaWisatawan: string;
  kategoriTiket: string;
  checkInAt: string;
  checkOutAt?: string | null;
}

/**
 * Booking kunjungan (Pemesanan). Wisatawan yang sudah memesan tapi BELUM tiba
 * di lokasi berstatus 'Tertunda' dan TIDAK dihitung di dashboard. Setelah admin
 * check-in (konfirmasi kedatangan) statusnya menjadi 'Hadir'.
 */
export interface Pemesanan {
  id: number;
  desaWisataId: number;
  nomorBooking: string;
  namaWisatawan: string;
  kategoriTiket: string; // 'Lokal' | 'Mancanegara'
  tanggalBooking: string; // tanggal/hari/tahun booking dibuat
  tanggalKunjungan: string; // tanggal/hari/tahun kunjungan yang direncanakan
  urlFoto: string;
  status: string; // 'Tertunda' | 'Hadir'
  checkInAt?: string | null;
  pengunjungId?: number | null;
}

export interface PemesananRequest {
  namaWisatawan: string;
  kategoriTiket?: string;
  tanggalKunjungan: string; // yyyy-MM-dd
  urlFoto?: string;
}

export interface Stats {
  totalDesa: number;
  desaAktif: number;
  totalWisatawan: number;
  totalPengunjungHariIni: number;
  desaOvertourism: number;
  totalPemesananTertunda: number;
  kategoriCounts: { kategori: string; jumlah: number }[];
  provinsiCounts: { provinsi: string; jumlah: number }[];
}

// ===== AUDIT LOG =====
export interface AuditLog {
  id: number;
  createdAt: string;
  userId: number | null;
  email: string;
  role: string;
  aksi: string;
  keterangan: string;
  entitas: string;
  entitasId: number | null;
  ipAddress: string;
}

// ===== MULTI-TENANT =====
export interface LoginResponse {
  token: string;
  expiresAt: string;
  userId: number;
  email: string;
  namaLengkap: string;
  role: 'SuperAdmin' | 'Admin' | string;
  organisasiId: number | null;
  organisasiNama: string | null;
}

export interface MeResponse {
  userId: number;
  email: string;
  namaLengkap: string;
  role: string;
  organisasiId: number | null;
  organisasiNama: string | null;
}

export interface Organisasi {
  id: number;
  namaOrganisasi: string;
  deskripsi: string;
  kontak: string;
  email: string;
  aktif: boolean;
  jumlahDesa: number;
  jumlahAdmin: number;
  createdAt: string;
}

export interface CreateOrganisasiRequest {
  namaOrganisasi: string;
  deskripsi?: string;
  kontak?: string;
  email?: string;
  adminEmail?: string;
  adminPassword?: string;
  adminNama?: string;
}

export interface UserAkun {
  id: number;
  email: string;
  namaLengkap: string;
  role: 'SuperAdmin' | 'Admin' | string;
  organisasiId: number | null;
  organisasiNama: string | null;
  aktif: boolean;
  createdAt: string;
}
