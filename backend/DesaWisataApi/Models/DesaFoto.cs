using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Satu foto pada galeri desa wisata. Foto diunggah admin lewat /api/Upload,
    /// lalu baris ini menyimpan URL-nya sebagai bagian koleksi galeri desa.
    /// </summary>
    public class DesaFoto
    {
        [Key]
        public int Id { get; set; }

        public int DesaWisataId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Url { get; set; } = string.Empty;

        /// <summary>Judul/caption foto, boleh kosong.</summary>
        [MaxLength(200)]
        public string Judul { get; set; } = string.Empty;

        /// <summary>Jenis item galeri: "foto" atau "video" (tautan YouTube/TikTok/Instagram).</summary>
        [MaxLength(10)]
        public string Tipe { get; set; } = "foto";

        /// <summary>Urutan tampil di galeri (kecil = tampil lebih dulu).</summary>
        public int Urutan { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // ===== NAVIGASI =====
        public DesaWisata? DesaWisata { get; set; }
    }
}
