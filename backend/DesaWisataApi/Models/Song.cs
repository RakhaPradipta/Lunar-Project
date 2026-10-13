using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Lagu YouTube pada pustaka musik latar — dimasukkan/dikelola admin (CRUD),
    /// diputar audio-only di klien via IFrame API (video resmi, tidak tampil di layar).
    /// </summary>
    public class Song
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Judul lagu (mis. "Pompeii").</summary>
        [MaxLength(120)]
        public string Judul { get; set; } = string.Empty;

        /// <summary>Nama artis/penyanyi (mis. "Bastille").</summary>
        [MaxLength(120)]
        public string Artis { get; set; } = string.Empty;

        /// <summary>ID video YouTube (bagian setelah watch?v=).</summary>
        [MaxLength(30)]
        public string VideoId { get; set; } = string.Empty;

        /// <summary>Deskripsi singkat / nuansa lagu.</summary>
        [MaxLength(300)]
        public string Deskripsi { get; set; } = string.Empty;

        /// <summary>Urutan tampil di daftar (kecil = atas).</summary>
        public int Urutan { get; set; }

        /// <summary>Lagu non-aktif disembunyikan dari pilihan player.</summary>
        public bool Aktif { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Email admin terakhir yang mengubah lagu ini.</summary>
        [MaxLength(150)]
        public string UpdatedBy { get; set; } = string.Empty;
    }
}
