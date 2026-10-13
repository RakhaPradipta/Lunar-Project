using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Tenant: sebuah organisasi (mis. dinas pariwisata kabupaten/kota atau pengelola
    /// beberapa desa) yang memiliki banyak DesaWisata. Setiap admin non-super terikat
    /// ke satu Organisasi dan hanya dapat mengelola desa milik organisasinya.
    /// </summary>
    public class Organisasi
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(150)]
        public string NamaOrganisasi { get; set; } = string.Empty;

        [MaxLength(300)]
        public string Deskripsi { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Kontak { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        public bool Aktif { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
