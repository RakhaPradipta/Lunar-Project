/**
 * DATA DEMO — mock realistis untuk MODE DEMO (VITE_DEMO_MODE=true).
 * Dipakai hanya oleh lapisan API frontend; tidak mengubah tampilan/backend.
 */
import type {
  DesaWisata, DesaFoto, Stats, Pengunjung, VisitorActivity,
  Pemesanan, PemesananRequest, ForecastHari,
} from '../types/desawisata';

const IMG = {
  baliSwing: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
  mountain: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  hills: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  misty: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
  lake: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
  meadow: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  ocean: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80',
  resort: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  baliGate: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80',
  temple: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=800&q=80',
  culture: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=800&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  resto: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  mosque: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&q=80',
};

function desa(
  id: number,
  namaDesa: string,
  kecamatan: string,
  kabupaten: string,
  provinsi: string,
  kategori: string,
  rating: number,
  jumlahWisatawan: number,
  urlGambar: string,
  deskripsi: string,
  latitude: number,
  longitude: number,
  hargaTiketLokal: number,
  hargaTiketMancanegara: number,
  batasPengunjung: number,
  pengunjungHariIni: number,
  extra?: Partial<DesaWisata>,
): DesaWisata {
  return {
    id,
    namaDesa,
    kecamatan,
    kabupaten,
    provinsi,
    deskripsi,
    lokasi: `${kecamatan}, ${kabupaten}, ${provinsi}`,
    urlGambar,
    urlWebsite: '',
    urlFoto: '',
    urlVideo: '',
    rating,
    jumlahWisatawan,
    kategori,
    aktif: true,
    latitude,
    longitude,
    batasPengunjung,
    pengunjungHariIni,
    overtourism: false,
    thresholdPeringatan: 80,
    autoLockOvertourism: true,
    pesanPeringatan: '',
    statusOperasional: 'Buka',
    jamBuka: '08:00',
    jamTutup: '17:00',
    hariOperasional: 'Senin–Minggu',
    kontakPengelola: '+62 812-3456-7890',
    emailPengelola: 'info@desawisata.id',
    socialMedia: '@desawisata.nusantara',
    hargaTiketLokal,
    hargaTiketMancanegara,
    hargaParkirMotor: 5000,
    hargaParkirMobil: 10000,
    persenPajakDaerah: 10,
    fasilitas: 'Toilet, Mushola, Parkir, Warung, Pemandu Wisata',
    organisasiId: 1,
    organisasiNama: 'Pokdarwis Nusantara',
    galeriFoto: [],
    createdAt: '2025-01-10T08:00:00',
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

export const DEMO_DESA: DesaWisata[] = [
  desa(1, 'Desa Penglipuran', 'Bangli', 'Bangli', 'Bali', 'Budaya', 4.9, 2400000, IMG.culture,
    'Desa adat terbersih di dunia dengan barisan bambu hijau, arsitektur Bali klasik, dan upacara adat yang lestari.',
    -8.4225, 115.3597, 25000, 100000, 2000, 640),
  desa(2, 'Terasering Ubud Sari', 'Tegallalang', 'Gianyar', 'Bali', 'Alam', 4.8, 1850000, IMG.baliSwing,
    'Hamparan sawah terasering hijau dengan ayunan jungle swing, spot sunrise, dan kafe sawah yang menenangkan.',
    -8.4314, 115.2777, 30000, 150000, 1500, 512),
  desa(3, 'Pantai Pink Tanjung Bira', 'Bonto Bahari', 'Bulukumba', 'Sulawesi Selatan', 'Pantai', 4.8, 960000, IMG.beach,
    'Pasir pantai semburat pink yang langka, air jernih gradasi biru, dan sunset ikonik ujung selatan Sulawesi.',
    -5.6067, 120.4417, 20000, 75000, 1200, 388),
  desa(4, 'Kampung Batik Borobudur', 'Borobudur', 'Magelang', 'Jawa Tengah', 'Budaya', 4.7, 1320000, IMG.baliGate,
    'Belajar membatik langsung dari perajin, dengan latar megah Candi Borobudur dan sunrise Punthuk Setumbu.',
    -7.6079, 110.2038, 15000, 60000, 1800, 701),
  desa(5, 'Dataran Tinggi Dieng', 'Batur', 'Banjarnegara', 'Jawa Tengah', 'Alam', 4.7, 1100000, IMG.misty,
    'Negeri di atas awan: kawah belerang, telaga warna, candi Hindu tertua di Jawa, dan embun es pagi hari.',
    -7.2061, 109.9186, 20000, 80000, 1600, 420,
    { statusOperasional: 'Buka', jamBuka: '06:00', jamTutup: '17:00' }),
  desa(6, 'Kampung Kuliner Malioboro', 'Gondomanan', 'Yogyakarta', 'Daerah Istimewa Yogyakarta', 'Kuliner', 4.6, 1750000, IMG.food,
    'Surga rasa Jogja: gudeg, sate klathak, bakpia, dan angkringan — wisata kuliner malam legendaris Malioboro.',
    -7.7929, 110.3658, 10000, 50000, 2500, 980,
    { statusOperasional: 'Khusus Reservasi', jamBuka: '10:00', jamTutup: '22:00' }),
  desa(7, 'Wisata Religi Sunan Ampel', 'Semampir', 'Surabaya', 'Jawa Timur', 'Religi', 4.8, 2100000, IMG.mosque,
    'Kawasan religi bersejarah makam Sunan Ampel dengan arsitektur Timur Tengah, kuliner Arab, dan pasar suvenir.',
    -7.2294, 112.7415, 5000, 20000, 3000, 1120),
  desa(8, 'Negeri Toraja Kete Kesu', 'Kesu', 'Tana Toraja', 'Sulawesi Selatan', 'Budaya', 4.9, 880000, IMG.temple,
    'Tongkonan megah, kuburan batu Lemo, dan ritual adat Rambu Solo — warisan budaya dunia yang memukau.',
    -2.9967, 119.9056, 25000, 100000, 1000, 295),
  desa(9, 'Kawah Bromo Tengger', 'Sukapura', 'Probolinggo', 'Jawa Timur', 'Alam', 4.9, 2600000, IMG.lake,
    'Sunrise Penanjakan, lautan pasir, dan kawah aktif Bromo — ikon wisata Jawa Timur yang mendunia.',
    -7.9425, 112.9530, 35000, 220000, 2200, 1890,
    { pesanPeringatan: 'Mendekati batas kapasitas harian, disarankan datang pagi hari.' }),
  desa(10, 'Pantai Senggigi Pesona', 'Batu Layar', 'Lombok Barat', 'Nusa Tenggara Barat', 'Pantai', 4.5, 720000, IMG.ocean,
    'Garis pantai emas Lombok dengan ombak tenang, cocok untuk snorkeling, sunset cruise, dan festival layang-layang.',
    -8.4796, 116.0403, 15000, 60000, 900, 900,
    { overtourism: true, pesanPeringatan: 'Kapasitas desa telah mencapai batas maksimal hari ini.' }),
];

const DEMO_NAMES = [
  'Ayu Lestari', 'Budi Santoso', 'Siti Rahma', 'Joko Prasetyo', 'Maria Ulfa',
  'Rudi Hartono', 'Dewi Anggraini', 'Andi Wijaya', 'Putri Maharani', 'Hendra Gunawan',
];

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60000).toISOString();
}

/** Efek "live": angka pengunjung bergerak kecil mengikuti waktu (untuk demo polling). */
function withJitter(list: DesaWisata[]): DesaWisata[] {
  const tick = Math.floor(Date.now() / 5000);
  return list.map((d, i) => {
    if (!d.aktif || d.batasPengunjung <= 0) return d;
    const delta = (tick + i * 3) % 4; // 0–3 orang per tick
    return { ...d, pengunjungHariIni: d.pengunjungHariIni + delta };
  });
}

export function demoFilterDesa(params?: {
  provinsi?: string; kategori?: string; search?: string; aktif?: boolean; mine?: boolean;
}): DesaWisata[] {
  let list = withJitter(DEMO_DESA);
  if (params?.provinsi) list = list.filter((d) => d.provinsi === params.provinsi);
  if (params?.kategori) list = list.filter((d) => d.kategori === params.kategori);
  if (params?.aktif !== undefined) list = list.filter((d) => d.aktif === params.aktif);
  if (params?.search) {
    const q = params.search.toLowerCase();
    list = list.filter((d) =>
      [d.namaDesa, d.kecamatan, d.kabupaten, d.provinsi, d.kategori, d.deskripsi]
        .join(' ').toLowerCase().includes(q),
    );
  }
  return list;
}

export function demoGetById(id: number): DesaWisata | undefined {
  return DEMO_DESA.find((d) => d.id === id);
}

export function demoStats(): Stats {
  const aktif = DEMO_DESA.filter((d) => d.aktif);
  const sum = (fn: (d: DesaWisata) => number) => DEMO_DESA.reduce((a, d) => a + fn(d), 0);
  const countBy = (key: 'kategori' | 'provinsi') => {
    const map = new Map<string, number>();
    DEMO_DESA.forEach((d) => map.set(d[key], (map.get(d[key]) ?? 0) + 1));
    return [...map.entries()].map(([name, jumlah]) =>
      key === 'kategori' ? { kategori: name, jumlah } : { provinsi: name, jumlah },
    );
  };
  return {
    totalDesa: DEMO_DESA.length,
    desaAktif: aktif.length,
    totalWisatawan: sum((d) => d.jumlahWisatawan),
    totalPengunjungHariIni: sum((d) => d.pengunjungHariIni),
    desaOvertourism: DEMO_DESA.filter((d) => d.overtourism).length,
    totalPemesananTertunda: 27,
    kategoriCounts: countBy('kategori') as Stats['kategoriCounts'],
    provinsiCounts: countBy('provinsi') as Stats['provinsiCounts'],
  };
}

export function demoGlobalActivity(): VisitorActivity[] {
  return DEMO_NAMES.slice(0, 8).map((nama, i) => {
    const d = DEMO_DESA[i % DEMO_DESA.length];
    const checkedOut = i % 4 === 3;
    return {
      id: 900 + i,
      desaWisataId: d.id,
      namaDesa: d.namaDesa,
      nomorKarcis: `T-${String(1200 + i * 7)}`,
      namaWisatawan: nama,
      kategoriTiket: i % 3 === 2 ? 'Mancanegara' : 'Lokal',
      checkInAt: isoMinutesAgo(12 + i * 17),
      checkOutAt: checkedOut ? isoMinutesAgo(5 + i * 3) : null,
    };
  });
}

export function demoVisitors(desaId: number): Pengunjung[] {
  const d = demoGetById(desaId);
  if (!d) return [];
  return DEMO_NAMES.slice(0, 5).map((nama, i) => ({
    id: 500 + i,
    desaWisataId: desaId,
    nomorKarcis: `T-${String(3400 + desaId * 11 + i)}`,
    namaWisatawan: nama,
    kategoriTiket: i % 4 === 3 ? 'Mancanegara' : 'Lokal',
    checkInAt: isoMinutesAgo(20 + i * 25),
    checkOutAt: i === 4 ? isoMinutesAgo(6) : null,
  }));
}

export function demoForecast(desaId: number): ForecastHari[] {
  const out: ForecastHari[] = [];
  const today = new Date();
  const pola = [42, 55, 48, 63, 78, 92, 70];
  for (let i = 0; i < 7; i++) {
    const t = new Date(today);
    t.setDate(today.getDate() + i);
    const persen = Math.min(100, pola[(i + desaId) % pola.length] + ((desaId * 7) % 9));
    out.push({
      tanggal: t.toISOString().slice(0, 10),
      hari: t.toLocaleDateString('id-ID', { weekday: 'long' }),
      persen,
      status: persen >= 100 ? 'Penuh' : persen >= 80 ? 'Ramai' : persen >= 50 ? 'Sedang' : 'Lengang',
    });
  }
  return out;
}

export function demoGallery(desaId: number): DesaFoto[] {
  const d = demoGetById(desaId);
  const pool = [IMG.meadow, IMG.hills, IMG.resort, IMG.resto];
  const main = d?.urlGambar ?? IMG.meadow;
  return [main, ...pool.slice(0, 3)].map((url, i) => ({
    id: desaId * 10 + i,
    desaWisataId: desaId,
    url,
    judul: i === 0 ? 'Foto utama' : `Galeri ${i}`,
    tipe: 'foto',
    urutan: i,
  }));
}

let demoBookingSeq = 1042;

export function demoCreateBooking(desaId: number, req: PemesananRequest): Pemesanan {
  demoBookingSeq += 1;
  return {
    id: demoBookingSeq,
    desaWisataId: desaId,
    nomorBooking: `DEMO-${demoBookingSeq}`,
    namaWisatawan: req.namaWisatawan,
    kategoriTiket: req.kategoriTiket || 'Lokal',
    tanggalBooking: new Date().toISOString().slice(0, 10),
    tanggalKunjungan: req.tanggalKunjungan,
    urlFoto: req.urlFoto || '',
    status: 'Tertunda',
    checkInAt: null,
    pengunjungId: null,
  };
}

/** Jawaban rule-based WisataBot saat mode demo (tanpa backend/Groq). */
export function demoAiReply(message: string): string {
  const m = message.toLowerCase();
  const names = DEMO_DESA.map((d) => d.namaDesa).join(', ');
  if (/(halo|hai|pagi|siang|sore|malam|hello)/.test(m)) {
    return 'Halo! Saya WisataBot 🌿 Asisten desa wisata Nusantara (mode demo). Tanya soal tiket, jam buka, zona keramaian, atau rekomendasi destinasi — misalnya "rekomendasi pantai" atau "tiket termurah".';
  }
  if (/(pantai|pesisir|snorkeling|diving)/.test(m)) {
    return 'Untuk pecinta pantai saya rekomendasikan 🏖️ Pantai Pink Tanjung Bira (Bulukumba, Rp 20rb) dan Pantai Senggigi Pesona (Lombok Barat, Rp 15rb). Keduanya berzona Sepi hari ini — puas untuk snorkeling! Catatan demo: Senggigi sedang Penuh, datang pagi ya.';
  }
  if (/(budaya|adat|tradisi|candi)/.test(m)) {
    return 'Pecinta budaya wajib ke 🎭 Desa Penglipuran (Bali, desa adat terbersih), Kampung Batik Borobudur (belajar membatik + Candi Borobudur), dan Negeri Toraja Kete Kesu (tongkonan & Rambu Solo). Semua rating 4.7–4.9!';
  }
  if (/(kuliner|makan|gudeg|sate)/.test(m)) {
    return 'Lapar? Ke 🍲 Kampung Kuliner Malioboro (Yogyakarta) — gudeg, sate klathak, bakpia, angkringan. Tiket masuk hanya Rp 10rb, buka 10:00–22:00 (khusus reservasi).';
  }
  if (/(religi|masjid|ziarah|spiritual)/.test(m)) {
    return 'Wisata religi: 🕌 Wisata Religi Sunan Ampel (Surabaya) — kawasan makam bersejarah, arsitektur Timur Tengah, tiket hanya Rp 5rb.';
  }
  if (/(murah|termurah|hemat|budget)/.test(m)) {
    return 'Paling hemat 💰: Wisata Religi Sunan Ampel (Rp 5rb), Kampung Kuliner Malioboro (Rp 10rb), dan Kampung Batik Borobudur / Pantai Senggigi (Rp 15rb). Pajak daerah 10% sudah termasuk info di tiap profil desa.';
  }
  if (/(ramai|sepi|zona|penuh|crowd|kapasitas)/.test(m)) {
    return 'Zona keramaian hari ini (live, mode demo): 🟢 8 desa Sepi/Nyaman, 🟡 1 Lumayan Rame (Kawah Bromo — 86% kapasitas), 🔴 1 Penuh (Pantai Senggigi). Filter zona tersedia di toolbar Destinasi Populer.';
  }
  if (/(tiket|harga|bayar|biaya)/.test(m)) {
    return 'Info tiket 🎫 (mode demo): harga lokal Rp 5rb–35rb tergantung desa, mancanegara hingga Rp 220rb (Bromo). Parkir motor Rp 5rb, mobil Rp 10rb. Booking bisa langsung dari tombol di profil tiap desa — dapat kode booking DEMO-xxxx.';
  }
  if (/(jam|buka|tutup|operasional)/.test(m)) {
    return 'Jam operasional 🕗 umumnya 08:00–17:00 setiap hari. Pengecualian: Dieng 06:00–17:00 (kejar sunrise) dan Kampung Kuliner Malioboro 10:00–22:00 (khusus reservasi).';
  }
  if (/(booking|pesan|reservasi|cara)/.test(m)) {
    return 'Cara booking 📝: buka profil desa → klik "Booking Tiket" → isi nama, kategori tiket & tanggal kunjungan → terima kode booking. Tanpa login, tanpa backend (mode demo) — kode langsung jadi!';
  }
  if (/(rekomendasi|bagus|populer|terbaik|hits)/.test(m)) {
    return 'Top 3 Terpopuler versi demo 👑: 1) Kawah Bromo Tengger 4.9, 2) Desa Penglipuran 4.9, 3) Negeri Toraja 4.9. Lihat mahkota emas di kartunya!';
  }
  return `Menarik! Dalam mode demo saya tahu 10 destinasi: ${names}. Coba tanya "rekomendasi pantai", "tiket termurah", "zona ramai hari ini", atau "cara booking". 🌺`;
}
