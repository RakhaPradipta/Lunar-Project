using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Catatan audit untuk aksi penting admin (login, edit, delete, dsb).
    /// Tambah-only: baris tidak pernah diubah/dihapus dari API agar jejak audit bisa dipercaya.
    /// </summary>
    public class AuditLog
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Waktu aksi (UTC).</summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Id user yang melakukan aksi (null bila anonim, mis. login gagal).</summary>
        public int? UserId { get; set; }

        /// <summary>Email user (disimpan eksplisit agar tetap terbaca walau user dihapus).</summary>
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        /// <summary>Role user saat aksi (SuperAdmin/Admin/Anonim).</summary>
        [MaxLength(30)]
        public string Role { get; set; } = string.Empty;

        /// <summary>Jenis aksi: LoginSuccess, LoginFailed, DesaCreate, DesaUpdate, DesaDelete, FotoAdd, FotoUpdate, FotoDelete, OrgCreate, OrgUpdate, OrgDelete, UserCreate, UserDelete, PemesananCheckIn, PemesananCheckOut, ResetVisitors.</summary>
        [MaxLength(30)]
        public string Aksi { get; set; } = string.Empty;

        /// <summary>Keterangan singkat manusiawi (mis. "Menghapus desa 'Sade'").</summary>
        [MaxLength(400)]
        public string Keterangan { get; set; } = string.Empty;

        /// <summary>Entitas terkait: DesaWisata/Foto/Organisasi/User/Auth.</summary>
        [MaxLength(30)]
        public string Entitas { get; set; } = string.Empty;

        /// <summary>Id entitas terkait bila relevan.</summary>
        public int? EntitasId { get; set; }

        /// <summary>IP address pelaku (untuk investigasi).</summary>
        [MaxLength(50)]
        public string IpAddress { get; set; } = string.Empty;
    }
}
