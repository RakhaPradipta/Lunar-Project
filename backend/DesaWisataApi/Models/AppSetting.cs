using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.Models
{
    /// <summary>
    /// Pengaturan situs yang dikendalikan admin (key-value sederhana).
    /// Dipakai untuk pengaturan global seperti musik latar.
    /// </summary>
    public class AppSetting
    {
        [Key]
        [MaxLength(80)]
        public string Key { get; set; } = string.Empty;

        /// <summary>Nilai pengaturan (string JSON / angka / teks pendek).</summary>
        public string Value { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Email admin terakhir yang mengubah pengaturan ini.</summary>
        [MaxLength(150)]
        public string UpdatedBy { get; set; } = string.Empty;
    }
}
