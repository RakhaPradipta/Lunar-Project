using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Akun admin backend. Role "SuperAdmin" dapat mengelola semua organisasi & desa.
    /// Role "Admin" terikat ke satu Organisasi (OrganisasiId) dan hanya boleh mengelola
    /// desa milik organisasinya. Password disimpan sebagai hash PBKDF2 + salt.
    /// </summary>
    public class AdminUser
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        /// <summary>Hash PBKDF2 format: {iterations}.{saltBase64}.{hashBase64}</summary>
        [Required]
        [MaxLength(500)]
        public string PasswordHash { get; set; } = string.Empty;

        [MaxLength(100)]
        public string NamaLengkap { get; set; } = string.Empty;

        /// <summary>"SuperAdmin" atau "Admin"</summary>
        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Admin";

        /// <summary>Null untuk SuperAdmin; wajib untuk Admin (tenant organisasi).</summary>
        public int? OrganisasiId { get; set; }

        public bool Aktif { get; set; } = true;

        public Organisasi? Organisasi { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
