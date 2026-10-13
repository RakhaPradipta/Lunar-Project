using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.DTOs
{
    public class LoginRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string NamaLengkap { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? OrganisasiId { get; set; }
        public string? OrganisasiNama { get; set; }
    }

    public class MeResponse
    {
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string NamaLengkap { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? OrganisasiId { get; set; }
        public string? OrganisasiNama { get; set; }
    }

    public class OrganisasiResponse
    {
        public int Id { get; set; }
        public string NamaOrganisasi { get; set; } = string.Empty;
        public string Deskripsi { get; set; } = string.Empty;
        public string Kontak { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public bool Aktif { get; set; }
        public int JumlahDesa { get; set; }
        public int JumlahAdmin { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateOrganisasiRequest
    {
        [Required]
        [MaxLength(150)]
        public string NamaOrganisasi { get; set; } = string.Empty;

        [MaxLength(300)]
        public string Deskripsi { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Kontak { get; set; } = string.Empty;

        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        /// <summary>Jika diisi, dibuatkan akun Admin pertama untuk organisasi ini.</summary>
        [EmailAddress]
        public string? AdminEmail { get; set; }

        public string? AdminPassword { get; set; }

        [MaxLength(100)]
        public string? AdminNama { get; set; }
    }

    public class UpdateOrganisasiRequest
    {
        public string? NamaOrganisasi { get; set; }
        public string? Deskripsi { get; set; }
        public string? Kontak { get; set; }
        public string? Email { get; set; }
        public bool? Aktif { get; set; }
    }

    public class CreateUserRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        [MaxLength(100)]
        public string NamaLengkap { get; set; } = string.Empty;

        /// <summary>"SuperAdmin" atau "Admin"</summary>
        [Required]
        public string Role { get; set; } = "Admin";

        /// <summary>Wajib untuk role Admin; diabaikan (null) untuk SuperAdmin.</summary>
        public int? OrganisasiId { get; set; }
    }

    public class UserResponse
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string NamaLengkap { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? OrganisasiId { get; set; }
        public string? OrganisasiNama { get; set; }
        public bool Aktif { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ChangePasswordRequest
    {
        [Required]
        public string PasswordLama { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string PasswordBaru { get; set; } = string.Empty;
    }
}
