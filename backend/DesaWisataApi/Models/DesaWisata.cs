using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    public class DesaWisata
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string NamaDesa { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Kecamatan { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Kabupaten { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Provinsi { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Deskripsi { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Lokasi { get; set; } = string.Empty;

        [MaxLength(500)]
        public string UrlGambar { get; set; } = string.Empty;

        // ===== TAUTAN EKSTERNAL (riset web per desa) =====
        [MaxLength(500)]
        public string UrlWebsite { get; set; } = string.Empty; // Website resmi desa / portal resmi
        [MaxLength(500)]
        public string UrlFoto { get; set; } = string.Empty; // Galeri foto (Google Images, dsb.)
        [MaxLength(500)]
        public string UrlVideo { get; set; } = string.Empty; // Video profil (TikTok / YouTube)

        public int Rating { get; set; }

        public int JumlahWisatawan { get; set; }

        [MaxLength(100)]
        public string Kategori { get; set; } = string.Empty;

        public bool Aktif { get; set; } = true;

        // ===== MULTI-TENANT: pemilik desa =====
        /// <summary>Organisasi (tenant) pemilik desa. 1 = organisasi seed default.</summary>
        public int OrganisasiId { get; set; } = 1;

        // GPS Coordinates
        public double Latitude { get; set; }
        public double Longitude { get; set; }

        // ===== PENGATURAN OVERTOURISM PER DESA =====
        public int BatasPengunjung { get; set; } = 500; // Kapasitas Maksimal Harian
        public int PengunjungHariIni { get; set; } = 0; // Jumlah Pengunjung Hari Ini
        public bool Overtourism { get; set; } = false; // Flag status overcapacity
        public int ThresholdPeringatan { get; set; } = 80; // Persentase ambang peringatan (misal 80%)
        public bool AutoLockOvertourism { get; set; } = true; // Otomatis kunci checkin jika penuh
        [MaxLength(500)]
        public string PesanPeringatan { get; set; } = "Kapasitas desa telah mencapai batas maksimal. Mohon berkunjung di waktu lain.";

        // ===== PENGATURAN OPERASIONAL DESA =====
        [MaxLength(50)]
        public string StatusOperasional { get; set; } = "Buka"; // "Buka", "Tutup Sementara", "Khusus Reservasi"
        [MaxLength(20)]
        public string JamBuka { get; set; } = "08:00";
        [MaxLength(20)]
        public string JamTutup { get; set; } = "17:00";
        [MaxLength(100)]
        public string HariOperasional { get; set; } = "Senin - Minggu";

        // ===== PENGATURAN KONTAK & PENGELOLA DESA =====
        [MaxLength(100)]
        public string KontakPengelola { get; set; } = string.Empty; // No WhatsApp / Telp
        [MaxLength(100)]
        public string EmailPengelola { get; set; } = string.Empty;
        [MaxLength(100)]
        public string SocialMedia { get; set; } = string.Empty; // Instagram / Website

        // ===== PENGATURAN TIKET & BIAYA DESA =====
        public int HargaTiketLokal { get; set; } = 10000;
        public int HargaTiketMancanegara { get; set; } = 50000;
        public int HargaParkirMotor { get; set; } = 3000;
        public int HargaParkirMobil { get; set; } = 10000;

        /// <summary>Pajak daerah (persen, 0–100) yang berlaku di kabupaten/kota desa. Contoh: 10 = 10%.</summary>
        public double PersenPajakDaerah { get; set; } = 10;

        // ===== PENGATURAN FASILITAS DESA =====
        [MaxLength(500)]
        public string Fasilitas { get; set; } = "Toilet, Area Parkir, Musholla, Homestay, WiFi";

        // ===== NAVIGASI MULTI-TENANT =====
        public Organisasi? Organisasi { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
