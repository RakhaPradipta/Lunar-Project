using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Klien website eksternal yang terhubung ke API ini.
    /// Satu website = satu tenant (Organisasi) + satu API key.
    /// Key disimpan sebagai hash SHA256; nilai asli hanya ditampilkan SEKALI saat dibuat/di-regenerate.
    /// </summary>
    public class ApiClient
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string NamaWebsite { get; set; } = string.Empty;

        /// <summary>URL/origin website klien (opsional, untuk dokumentasi).</summary>
        [MaxLength(300)]
        public string UrlWebsite { get; set; } = string.Empty;

        /// <summary>Email kontak klien (opsional).</summary>
        [MaxLength(150)]
        public string EmailKontak { get; set; } = string.Empty;

        /// <summary>SHA256 dari API key. Key asli tidak pernah disimpan.</summary>
        [Required]
        public string KeyHash { get; set; } = string.Empty;

        /// <summary>Potongan awal key untuk identifikasi di UI (mis. "dwk_a1b2…").</summary>
        [MaxLength(20)]
        public string KeyPreview { get; set; } = string.Empty;

        /// <summary>Tenant (Organisasi) tempat website ini terikat. Desa yang bisa dilihat = desa organisasi ini.</summary>
        public int OrganisasiId { get; set; }

        public bool Aktif { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastUsedAt { get; set; }

        /// <summary>Jumlah request yang masuk dengan key ini (metrik sederhana).</summary>
        public long JumlahRequest { get; set; }

        // ===== NAVIGASI =====
        public Organisasi? Organisasi { get; set; }
    }
}
