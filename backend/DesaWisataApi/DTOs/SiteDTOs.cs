using System.ComponentModel.DataAnnotations;

namespace DesaWisataApi.DTOs
{
    // ===== REGISTRASI WEBSITE EKSTERNAL (auto-generate tenant + API key) =====

    public class RegisterSiteRequest
    {
        /// <summary>Nama website/portal yang mendaftar, mis. "Portal Wisata Jawa Timur".</summary>
        [Required]
        [MaxLength(150)]
        public string NamaWebsite { get; set; } = string.Empty;

        /// <summary>URL website klien, mis. "https://wisatajatim.com" (opsional).</summary>
        [MaxLength(300)]
        public string? UrlWebsite { get; set; }

        /// <summary>Email kontak klien (opsional).</summary>
        [EmailAddress]
        [MaxLength(150)]
        public string? EmailKontak { get; set; }

        /// <summary>
        /// Opsional: organisasi (tenant) yang sudah ada jika website dimiliki tenant internal.
        /// Kosongkan untuk auto-generate organisasi baru.
        /// </summary>
        public int? OrganisasiId { get; set; }
    }

    public class RegisterSiteResponse
    {
        public int ClientId { get; set; }
        public string NamaWebsite { get; set; } = string.Empty;

        /// <summary>Tenant yang dipakai/dibuat untuk website ini.</summary>
        public int OrganisasiId { get; set; }
        public string OrganisasiNama { get; set; } = string.Empty;

        /// <summary>API key. HANYA ditampilkan sekali pada response ini — server hanya menyimpan hash.</summary>
        public string ApiKey { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
    }

    /// <summary>Info klien untuk SuperAdmin (tanpa key asli, tentu saja).</summary>
    public class ApiClientResponse
    {
        public int Id { get; set; }
        public string NamaWebsite { get; set; } = string.Empty;
        public string UrlWebsite { get; set; } = string.Empty;
        public string EmailKontak { get; set; } = string.Empty;
        public string KeyPreview { get; set; } = string.Empty;
        public int OrganisasiId { get; set; }
        public string OrganisasiNama { get; set; } = string.Empty;
        public bool Aktif { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public long JumlahRequest { get; set; }
    }

    /// <summary>Identitas klien setelah validasi X-Api-Key (dipakai untuk scoping data).</summary>
    public class SiteMeResponse
    {
        public int ClientId { get; set; }
        public string NamaWebsite { get; set; } = string.Empty;
        public int OrganisasiId { get; set; }
        public string OrganisasiNama { get; set; } = string.Empty;
        public int JumlahDesa { get; set; }
    }

    /// <summary>Desa versi publik-website (ringkas, aman untuk konsumsi eksternal).</summary>
    public class SiteDesaResponse
    {
        public int Id { get; set; }
        public string NamaDesa { get; set; } = string.Empty;
        public string Kecamatan { get; set; } = string.Empty;
        public string Kabupaten { get; set; } = string.Empty;
        public string Provinsi { get; set; } = string.Empty;
        public string Deskripsi { get; set; } = string.Empty;
        public string Kategori { get; set; } = string.Empty;
        public string UrlGambar { get; set; } = string.Empty;
        public int Rating { get; set; }
        public bool Aktif { get; set; }

        public string StatusOperasional { get; set; } = string.Empty;
        public string JamBuka { get; set; } = string.Empty;
        public string JamTutup { get; set; } = string.Empty;
        public string HariOperasional { get; set; } = string.Empty;

        public int HargaTiketLokal { get; set; }
        public int HargaTiketMancanegara { get; set; }

        /// <summary>Pajak daerah (persen) untuk desa ini.</summary>
        public double PersenPajakDaerah { get; set; } = 10;

        public int BatasPengunjung { get; set; }
        public int PengunjungHariIni { get; set; }
        public bool Overtourism { get; set; }
        public int ThresholdPeringatan { get; set; }

        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string Fasilitas { get; set; } = string.Empty;

        public List<DesaFotoResponse> GaleriFoto { get; set; } = new();
    }
}
