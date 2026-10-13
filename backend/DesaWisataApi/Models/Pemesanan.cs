using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Satu baris = satu pemesanan (booking) kunjungan wisata yang dibuat pengunjung
    /// SEBELUM tiba di desa. Status awal "Tertunda" (sudah booking, belum ada di lokasi)
    /// dan TIDAK dihitung sebagai wisatawan di desa (tidak menyentuh PengunjungHariIni
    /// / JumlahWisatawan). Saat wisatawan benar-benar tiba di lokasi, admin check-in
    /// (konfirmasi kedatangan) -> status menjadi "Hadir" dan baris Pengunjung/karcis
    /// dibuat, barulah ia terhitung di dashboard per-desa & global.
    /// </summary>
    public class Pemesanan
    {
        [Key]
        public int Id { get; set; }

        public int DesaWisataId { get; set; }

        /// <summary>Kode booking yang ditunjukkan wisatawan saat tiba, mis. B-001-20260904-0001</summary>
        [Required]
        [MaxLength(30)]
        public string NomorBooking { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string NamaWisatawan { get; set; } = string.Empty;

        /// <summary>"Lokal" atau "Mancanegara"</summary>
        [Required]
        [MaxLength(20)]
        public string KategoriTiket { get; set; } = "Lokal";

        /// <summary>Tanggal & jam saat pemesanan dibuat (data tanggal/hari/tahun booking).</summary>
        public DateTime TanggalBooking { get; set; } = DateTime.UtcNow;

        /// <summary>Tanggal kunjungan yang direncanakan (data tanggal/hari/tahun kunjungan).</summary>
        public DateTime TanggalKunjungan { get; set; }

        /// <summary>URL foto yang dilampirkan pengunjung saat booking (opsional).</summary>
        [MaxLength(500)]
        public string UrlFoto { get; set; } = string.Empty;

        /// <summary>"Tertunda" (sudah booking, belum ada di lokasi) atau "Hadir" (sudah check-in di lokasi).</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "Tertunda";

        public DateTime? CheckInAt { get; set; }

        public int? PengunjungId { get; set; }

        public DesaWisata? DesaWisata { get; set; }
    }
}
