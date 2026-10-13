using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Satu baris = satu wisatawan yang check-in (memegang satu karcis).
    /// Check-out dilakukan dengan mencocokkan NomorKarcis.
    /// </summary>
    public class Pengunjung
    {
        [Key]
        public int Id { get; set; }

        public int DesaWisataId { get; set; }

        [Required]
        [MaxLength(30)]
        public string NomorKarcis { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string NamaWisatawan { get; set; } = string.Empty;

        /// <summary>"Lokal" atau "Mancanegara"</summary>
        [Required]
        [MaxLength(20)]
        public string KategoriTiket { get; set; } = "Lokal";

        public DateTime CheckInAt { get; set; } = DateTime.UtcNow;

        public DateTime? CheckOutAt { get; set; }

        public DesaWisata? DesaWisata { get; set; }
    }
}
