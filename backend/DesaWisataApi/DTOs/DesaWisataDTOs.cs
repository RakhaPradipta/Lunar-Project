namespace DesaWisataApi.DTOs
{
    public class DesaWisataResponse
    {
        public int Id { get; set; }
        public string NamaDesa { get; set; } = string.Empty;
        public string Kecamatan { get; set; } = string.Empty;
        public string Kabupaten { get; set; } = string.Empty;
        public string Provinsi { get; set; } = string.Empty;
        public string Deskripsi { get; set; } = string.Empty;
        public string Lokasi { get; set; } = string.Empty;
        public string UrlGambar { get; set; } = string.Empty;

        // Tautan eksternal (website resmi / galeri foto / video)
        public string UrlWebsite { get; set; } = string.Empty;
        public string UrlFoto { get; set; } = string.Empty;
        public string UrlVideo { get; set; } = string.Empty;

        public int Rating { get; set; }
        public int JumlahWisatawan { get; set; }
        public string Kategori { get; set; } = string.Empty;
        public bool Aktif { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }

        // Overtourism per desa
        public int BatasPengunjung { get; set; }
        public int PengunjungHariIni { get; set; }
        public bool Overtourism { get; set; }
        public int ThresholdPeringatan { get; set; }
        public bool AutoLockOvertourism { get; set; }
        public string PesanPeringatan { get; set; } = string.Empty;

        // Operational
        public string StatusOperasional { get; set; } = string.Empty;
        public string JamBuka { get; set; } = string.Empty;
        public string JamTutup { get; set; } = string.Empty;
        public string HariOperasional { get; set; } = string.Empty;

        // Contact
        public string KontakPengelola { get; set; } = string.Empty;
        public string EmailPengelola { get; set; } = string.Empty;
        public string SocialMedia { get; set; } = string.Empty;

        // Pricing
        public int HargaTiketLokal { get; set; }
        public int HargaTiketMancanegara { get; set; }
        public int HargaParkirMotor { get; set; }
        public int HargaParkirMobil { get; set; }

        /// <summary>Pajak daerah (persen) untuk desa ini.</summary>
        public double PersenPajakDaerah { get; set; } = 10;

        // Facilities
        public string Fasilitas { get; set; } = string.Empty;

        // Multi-tenant: pemilik desa
        public int OrganisasiId { get; set; }
        public string OrganisasiNama { get; set; } = string.Empty;

        // Galeri foto (multi-foto per desa)
        public List<DesaFotoResponse> GaleriFoto { get; set; } = new();

        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class DesaFotoResponse
    {
        public int Id { get; set; }
        public int DesaWisataId { get; set; }
        public string Url { get; set; } = string.Empty;
        public string Judul { get; set; } = string.Empty;
        public string Tipe { get; set; } = "foto";
        public int Urutan { get; set; }
    }

    public class CreateDesaWisataRequest
    {
        public string NamaDesa { get; set; } = string.Empty;
        public string Kecamatan { get; set; } = string.Empty;
        public string Kabupaten { get; set; } = string.Empty;
        public string Provinsi { get; set; } = string.Empty;
        public string Deskripsi { get; set; } = string.Empty;
        public string Lokasi { get; set; } = string.Empty;
        public string UrlGambar { get; set; } = string.Empty;

        // Tautan eksternal
        public string UrlWebsite { get; set; } = string.Empty;
        public string UrlFoto { get; set; } = string.Empty;
        public string UrlVideo { get; set; } = string.Empty;

        public int Rating { get; set; } = 5;
        public int JumlahWisatawan { get; set; } = 0;
        public string Kategori { get; set; } = string.Empty;
        public bool Aktif { get; set; } = true;
        public double Latitude { get; set; }
        public double Longitude { get; set; }

        // Overtourism
        public int BatasPengunjung { get; set; } = 500;
        public int PengunjungHariIni { get; set; } = 0;
        public bool Overtourism { get; set; } = false;
        public int ThresholdPeringatan { get; set; } = 80;
        public bool AutoLockOvertourism { get; set; } = true;
        public string PesanPeringatan { get; set; } = "Kapasitas desa telah mencapai batas maksimal.";

        // Operational
        public string StatusOperasional { get; set; } = "Buka";
        public string JamBuka { get; set; } = "08:00";
        public string JamTutup { get; set; } = "17:00";
        public string HariOperasional { get; set; } = "Senin - Minggu";

        // Contact
        public string KontakPengelola { get; set; } = string.Empty;
        public string EmailPengelola { get; set; } = string.Empty;
        public string SocialMedia { get; set; } = string.Empty;

        // Pricing
        public int HargaTiketLokal { get; set; } = 10000;
        public int HargaTiketMancanegara { get; set; } = 50000;
        public int HargaParkirMotor { get; set; } = 3000;
        public int HargaParkirMobil { get; set; } = 10000;

        /// <summary>Pajak daerah (persen) untuk desa ini.</summary>
        public double PersenPajakDaerah { get; set; } = 10;

        // Facilities
        public string Fasilitas { get; set; } = "Toilet, Area Parkir, Musholla, Homestay, WiFi";

        // Multi-tenant: hanya dipakai SuperAdmin (Admin selalu di-set ke organisasinya sendiri)
        public int? OrganisasiId { get; set; }
    }

    public class UpdateDesaWisataRequest
    {
        public string? NamaDesa { get; set; }
        public string? Kecamatan { get; set; }
        public string? Kabupaten { get; set; }
        public string? Provinsi { get; set; }
        public string? Deskripsi { get; set; }
        public string? Lokasi { get; set; }
        public string? UrlGambar { get; set; }

        // Tautan eksternal
        public string? UrlWebsite { get; set; }
        public string? UrlFoto { get; set; }
        public string? UrlVideo { get; set; }

        public int? Rating { get; set; }
        public int? JumlahWisatawan { get; set; }
        public string? Kategori { get; set; }
        public bool? Aktif { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        // Overtourism
        public int? BatasPengunjung { get; set; }
        public int? PengunjungHariIni { get; set; }
        public bool? Overtourism { get; set; }
        public int? ThresholdPeringatan { get; set; }
        public bool? AutoLockOvertourism { get; set; }
        public string? PesanPeringatan { get; set; }

        // Operational
        public string? StatusOperasional { get; set; }
        public string? JamBuka { get; set; }
        public string? JamTutup { get; set; }
        public string? HariOperasional { get; set; }

        // Contact
        public string? KontakPengelola { get; set; }
        public string? EmailPengelola { get; set; }
        public string? SocialMedia { get; set; }

        // Pricing
        public int? HargaTiketLokal { get; set; }
        public int? HargaTiketMancanegara { get; set; }
        public int? HargaParkirMotor { get; set; }
        public int? HargaParkirMobil { get; set; }

        /// <summary>Pajak daerah (persen 0–100).</summary>
        public double? PersenPajakDaerah { get; set; }

        // Facilities
        public string? Fasilitas { get; set; }

        // Multi-tenant: hanya dipakai SuperAdmin
        public int? OrganisasiId { get; set; }
    }

    public class DesaFotoRequest
    {
        /// <summary>URL foto (hasil unggah /api/Upload atau URL eksternal).</summary>
        public string Url { get; set; } = string.Empty;

        /// <summary>Judul/caption opsional.</summary>
        public string? Judul { get; set; }

        /// <summary>Jenis item: "foto" (default) atau "video" (tautan YouTube/TikTok/Instagram).</summary>
        public string? Tipe { get; set; }

        /// <summary>Urutan tampil di galeri (opsional; default = paling akhir).</summary>
        public int? Urutan { get; set; }
    }

    /// <summary>Satu hari prakiraan keramaian desa.</summary>
    public class ForecastHariResponse
    {
        /// <summary>Tanggal (yyyy-MM-dd).</summary>
        public string Tanggal { get; set; } = string.Empty;
        /// <summary>Nama hari (Senin, Selasa, ...).</summary>
        public string Hari { get; set; } = string.Empty;
        /// <summary>Perkiraan tingkat keterisian (0–100+).</summary>
        public int Persen { get; set; }
        /// <summary>Status: Lengang / Sedang / Ramai / Penuh.</summary>
        public string Status { get; set; } = string.Empty;
    }

    public class CheckInRequest
    {
        public string NamaWisatawan { get; set; } = string.Empty;
        public string KategoriTiket { get; set; } = "Lokal";

        /// <summary>
        /// Opsional. Jika diisi, check-in ini berarti "konfirmasi kedatangan" dari sebuah
        /// booking (Pemesanan) yang masih berstatus Tertunda -> wisatawan baru dihitung
        /// setelah benar-benar tiba di lokasi.
        /// </summary>
        public string? NomorBooking { get; set; }
    }

    public class PemesananRequest
    {
        public string NamaWisatawan { get; set; } = string.Empty;
        public string KategoriTiket { get; set; } = "Lokal";

        /// <summary>Tanggal kunjungan yang direncanakan (yyyy-MM-dd atau ISO datetime).</summary>
        public DateTime? TanggalKunjungan { get; set; }

        public string UrlFoto { get; set; } = string.Empty;
    }

    public class PemesananResponse
    {
        public int Id { get; set; }
        public int DesaWisataId { get; set; }
        public string NomorBooking { get; set; } = string.Empty;
        public string NamaWisatawan { get; set; } = string.Empty;
        public string KategoriTiket { get; set; } = string.Empty;
        public DateTime TanggalBooking { get; set; }
        public DateTime TanggalKunjungan { get; set; }
        public string UrlFoto { get; set; } = string.Empty;
        public string Status { get; set; } = "Tertunda";
        public DateTime? CheckInAt { get; set; }
        public int? PengunjungId { get; set; }
    }

    public class CheckOutRequest
    {
        public string NomorKarcis { get; set; } = string.Empty;
    }

    public class PengunjungResponse
    {
        public int Id { get; set; }
        public int DesaWisataId { get; set; }
        public string NomorKarcis { get; set; } = string.Empty;
        public string NamaWisatawan { get; set; } = string.Empty;
        public string KategoriTiket { get; set; } = string.Empty;
        public DateTime CheckInAt { get; set; }
        public DateTime? CheckOutAt { get; set; }
    }

    public class VisitorActionResponse
    {
        public DesaWisataResponse Desa { get; set; } = new DesaWisataResponse();
        public PengunjungResponse Pengunjung { get; set; } = new PengunjungResponse();
    }

    public class VisitorActivityResponse
    {
        public int Id { get; set; }
        public int DesaWisataId { get; set; }
        public string NamaDesa { get; set; } = string.Empty;
        public string NomorKarcis { get; set; } = string.Empty;
        public string NamaWisatawan { get; set; } = string.Empty;
        public string KategoriTiket { get; set; } = string.Empty;
        public DateTime CheckInAt { get; set; }
        public DateTime? CheckOutAt { get; set; }
    }

    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
        public int TotalData { get; set; }
    }
}
