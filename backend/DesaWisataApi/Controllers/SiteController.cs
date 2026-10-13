using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using DesaWisataApi.DTOs;
using DesaWisataApi.Services;

namespace DesaWisataApi.Controllers
{
    /// <summary>
    /// Integrasi website eksternal: satu website = satu tenant (Organisasi) + satu API key.
    /// Website baru mendaftar via POST /register (publik) dan otomatis mendapat tenant + API key.
    /// Key dikirim pada header "X-Api-Key" oleh website klien.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SiteController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SiteController(AppDbContext context)
        {
            _context = context;
        }

        private CurrentAdmin? CurrentUser => CurrentAdmin.FromPrincipal(User);

        // ===== HELPERS API KEY =====

        private static string GenerateApiKey()
        {
            // 32 byte acak -> 43 karakter url-safe base64, prefiks "dwk_"
            var bytes = RandomNumberGenerator.GetBytes(32);
            return "dwk_" + Convert.ToBase64String(bytes)
                .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        }

        private static string HashKey(string key) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key))).ToLowerInvariant();

        private sealed record ClientValidationResult(ApiClient Client, string? Error, int? Status);

        private async Task<ClientValidationResult> ValidateKeyAsync()
        {
            var key = Request.Headers["X-Api-Key"].FirstOrDefault()?.Trim();
            if (string.IsNullOrEmpty(key))
                return new ClientValidationResult(null!, "Header X-Api-Key wajib diisi", 401);

            var hash = HashKey(key);
            var client = await _context.ApiClients
                .Include(c => c.Organisasi)
                .FirstOrDefaultAsync(c => c.KeyHash == hash);

            if (client == null)
                return new ClientValidationResult(null!, "API key tidak valid", 401);
            if (!client.Aktif)
                return new ClientValidationResult(null!, "API key telah dinonaktifkan. Hubungi admin pusat.", 403);

            // Metrik pemakaian TANPA write-per-request (dulu SaveChangesAsync tiap request =
            // hot path DB yang tidak perlu). Hitung di memori; flush periodic oleh
            // MetricsFlushService, dan data tetap tampil di dashboard SuperAdmin.
            ApiMetrics.Track(client.Id);

            return new ClientValidationResult(client, null, null);
        }

        // ===== 1. REGISTRASI (PUBLIK) — inilah "auto-generate"-nya =====

        /// <summary>
        /// Website baru mendaftar -> server otomatis membuat Organisasi (tenant) baru
        /// (atau memakai OrganisasiId yang diberikan) + meng-generate API key.
        /// API key HANYA dikembalikan sekali di response ini.
        /// </summary>
        [HttpPost("register")]
        [AllowAnonymous]
        [EnableRateLimiting("register-site")]
        public async Task<ActionResult<ApiResponse<RegisterSiteResponse>>> Register([FromBody] RegisterSiteRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new ApiResponse<RegisterSiteResponse> { Success = false, Message = "Data tidak valid" });

            var nama = request.NamaWebsite?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(nama))
                return BadRequest(new ApiResponse<RegisterSiteResponse> { Success = false, Message = "NamaWebsite wajib diisi" });

            // Tentukan tenant: pakai yang ada, atau auto-generate organisasi baru.
            // ===== KEAMANAN (anti tenant-hijack): memilih OrganisasiId yang sudah ada
            // hanya boleh dilakukan SuperAdmin. Anonim selalu mendapat tenant baru,
            // sehingga tidak bisa menempelkan API key-nya ke organisasi orang lain
            // lalu membaca data desa tenant tersebut via /api/Site/desa.
            int orgId;
            string orgNama;
            if (request.OrganisasiId.HasValue)
            {
                var admin = CurrentUser;
                if (admin == null || !admin.IsSuperAdmin)
                    return StatusCode(403, new ApiResponse<RegisterSiteResponse>
                    {
                        Success = false,
                        Message = "Hanya SuperAdmin yang dapat menautkan website ke organisasi yang sudah ada. Biarkan OrganisasiId kosong untuk tenant baru."
                    });

                var org = await _context.Organisasi.FirstOrDefaultAsync(o => o.Id == request.OrganisasiId.Value);
                if (org == null)
                    return BadRequest(new ApiResponse<RegisterSiteResponse> { Success = false, Message = "OrganisasiId tidak ditemukan" });
                orgId = org.Id;
                orgNama = org.NamaOrganisasi;
            }
            else
            {
                var newOrg = new Organisasi
                {
                    NamaOrganisasi = $"[Web] {nama}",
                    Deskripsi = $"Tenant otomatis untuk website '{nama}' (terdaftar {DateTime.UtcNow:yyyy-MM-dd}).",
                    Email = request.EmailKontak?.Trim() ?? string.Empty,
                    Aktif = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Organisasi.Add(newOrg);
                await _context.SaveChangesAsync(); // butuh Id
                orgId = newOrg.Id;
                orgNama = newOrg.NamaOrganisasi;
            }

            // Generate key + simpan hash-nya saja
            var apiKey = GenerateApiKey();
            var client = new ApiClient
            {
                NamaWebsite = nama,
                UrlWebsite = request.UrlWebsite?.Trim() ?? string.Empty,
                EmailKontak = request.EmailKontak?.Trim() ?? string.Empty,
                KeyHash = HashKey(apiKey),
                KeyPreview = apiKey[..Math.Min(12, apiKey.Length)] + "…",
                OrganisasiId = orgId,
                Aktif = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.ApiClients.Add(client);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<RegisterSiteResponse>
            {
                Success = true,
                Message = "Website berhasil terdaftar. SIMPAN API KEY sekarang — key hanya ditampilkan sekali!",
                Data = new RegisterSiteResponse
                {
                    ClientId = client.Id,
                    NamaWebsite = client.NamaWebsite,
                    OrganisasiId = orgId,
                    OrganisasiNama = orgNama,
                    ApiKey = apiKey,
                    CreatedAt = client.CreatedAt
                }
            });
        }

        // ===== 2. ENDPOINT UNTUK WEBSITE KLIEN (X-Api-Key) =====

        /// <summary>Validasi key + info tenant yang terikat pada website ini.</summary>
        [HttpGet("me")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<SiteMeResponse>>> Me()
        {
            var v = await ValidateKeyAsync();
            if (v.Error != null)
                return v.Status == 403
                    ? StatusCode(403, new ApiResponse<SiteMeResponse> { Success = false, Message = v.Error })
                    : Unauthorized(new ApiResponse<SiteMeResponse> { Success = false, Message = v.Error });

            var c = v.Client;
            var jumlahDesa = await _context.DesaWisata.CountAsync(d => d.OrganisasiId == c.OrganisasiId && d.Aktif);

            return Ok(new ApiResponse<SiteMeResponse>
            {
                Success = true,
                Message = "API key valid",
                Data = new SiteMeResponse
                {
                    ClientId = c.Id,
                    NamaWebsite = c.NamaWebsite,
                    OrganisasiId = c.OrganisasiId,
                    OrganisasiNama = c.Organisasi?.NamaOrganisasi ?? string.Empty,
                    JumlahDesa = jumlahDesa
                }
            });
        }

        /// <summary>Daftar desa milik tenant website ini (scoped, hanya yang aktif), dengan filter opsional.</summary>
        [HttpGet("desa")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<SiteDesaResponse>>>> GetDesa(
            [FromQuery] string? kategori,
            [FromQuery] string? provinsi,
            [FromQuery] string? search)
        {
            var v = await ValidateKeyAsync();
            if (v.Error != null)
                return v.Status == 403
                    ? StatusCode(403, new ApiResponse<List<SiteDesaResponse>> { Success = false, Message = v.Error })
                    : Unauthorized(new ApiResponse<List<SiteDesaResponse>> { Success = false, Message = v.Error });

            var query = _context.DesaWisata
                .Include(d => d.Organisasi)
                .Where(d => d.OrganisasiId == v.Client.OrganisasiId && d.Aktif);

            if (!string.IsNullOrEmpty(kategori)) query = query.Where(d => d.Kategori == kategori);
            if (!string.IsNullOrEmpty(provinsi)) query = query.Where(d => d.Provinsi.Contains(provinsi));
            if (!string.IsNullOrEmpty(search)) query = query.Where(d => d.NamaDesa.Contains(search) || d.Deskripsi.Contains(search));

            var data = await query.OrderBy(d => d.NamaDesa).ToListAsync();

            // Galeri foto diambil batch untuk semua desa
            var ids = data.Select(d => d.Id).ToList();
            var fotos = ids.Count > 0
                ? await _context.DesaFotos
                    .Where(f => ids.Contains(f.DesaWisataId))
                    .OrderBy(f => f.Urutan).ThenBy(f => f.Id)
                    .ToListAsync()
                : new List<DesaFoto>();

            var response = data.Select(d => new SiteDesaResponse
            {
                Id = d.Id,
                NamaDesa = d.NamaDesa,
                Kecamatan = d.Kecamatan,
                Kabupaten = d.Kabupaten,
                Provinsi = d.Provinsi,
                Deskripsi = d.Deskripsi,
                Kategori = d.Kategori,
                UrlGambar = d.UrlGambar,
                Rating = d.Rating,
                Aktif = d.Aktif,
                StatusOperasional = d.StatusOperasional,
                JamBuka = d.JamBuka,
                JamTutup = d.JamTutup,
                HariOperasional = d.HariOperasional,
                HargaTiketLokal = d.HargaTiketLokal,
                HargaTiketMancanegara = d.HargaTiketMancanegara,
                PersenPajakDaerah = d.PersenPajakDaerah,
                BatasPengunjung = d.BatasPengunjung,
                PengunjungHariIni = d.PengunjungHariIni,
                Overtourism = d.Overtourism,
                ThresholdPeringatan = d.ThresholdPeringatan,
                Latitude = d.Latitude,
                Longitude = d.Longitude,
                Fasilitas = d.Fasilitas,
                GaleriFoto = fotos.Where(f => f.DesaWisataId == d.Id).Select(f => new DesaFotoResponse
                {
                    Id = f.Id,
                    DesaWisataId = f.DesaWisataId,
                    Url = f.Url,
                    Judul = f.Judul,
                    Tipe = f.Tipe,
                    Urutan = f.Urutan
                }).ToList()
            }).ToList();

            return Ok(new ApiResponse<List<SiteDesaResponse>>
            {
                Success = true,
                Message = "Data desa berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        /// <summary>Detail satu desa (scoped ke tenant website ini).</summary>
        [HttpGet("desa/{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<SiteDesaResponse>>> GetDesaById(int id)
        {
            var v = await ValidateKeyAsync();
            if (v.Error != null)
                return v.Status == 403
                    ? StatusCode(403, new ApiResponse<SiteDesaResponse> { Success = false, Message = v.Error })
                    : Unauthorized(new ApiResponse<SiteDesaResponse> { Success = false, Message = v.Error });

            var d = await _context.DesaWisata
                .FirstOrDefaultAsync(x => x.Id == id && x.OrganisasiId == v.Client.OrganisasiId);
            if (d == null)
                return NotFound(new ApiResponse<SiteDesaResponse> { Success = false, Message = "Desa tidak ditemukan untuk website Anda" });

            var fotos = await _context.DesaFotos
                .Where(f => f.DesaWisataId == d.Id)
                .OrderBy(f => f.Urutan).ThenBy(f => f.Id)
                .ToListAsync();

            return Ok(new ApiResponse<SiteDesaResponse>
            {
                Success = true,
                Message = "Data desa berhasil diambil",
                Data = new SiteDesaResponse
                {
                    Id = d.Id,
                    NamaDesa = d.NamaDesa,
                    Kecamatan = d.Kecamatan,
                    Kabupaten = d.Kabupaten,
                    Provinsi = d.Provinsi,
                    Deskripsi = d.Deskripsi,
                    Kategori = d.Kategori,
                    UrlGambar = d.UrlGambar,
                    Rating = d.Rating,
                    Aktif = d.Aktif,
                    StatusOperasional = d.StatusOperasional,
                    JamBuka = d.JamBuka,
                    JamTutup = d.JamTutup,
                    HariOperasional = d.HariOperasional,
                    HargaTiketLokal = d.HargaTiketLokal,
                    HargaTiketMancanegara = d.HargaTiketMancanegara,
                    PersenPajakDaerah = d.PersenPajakDaerah,
                    BatasPengunjung = d.BatasPengunjung,
                    PengunjungHariIni = d.PengunjungHariIni,
                    Overtourism = d.Overtourism,
                    ThresholdPeringatan = d.ThresholdPeringatan,
                    Latitude = d.Latitude,
                    Longitude = d.Longitude,
                    Fasilitas = d.Fasilitas,
                    GaleriFoto = fotos.Select(f => new DesaFotoResponse
                    {
                        Id = f.Id,
                        DesaWisataId = f.DesaWisataId,
                        Url = f.Url,
                        Judul = f.Judul,
                        Tipe = f.Tipe,
                        Urutan = f.Urutan
                    }).ToList()
                }
            });
        }

        // ===== 3. MANAJEMEN KLIEN (SuperAdmin) =====

        /// <summary>Daftar semua website klien terdaftar.</summary>
        [HttpGet("clients")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<List<ApiClientResponse>>>> GetClients()
        {
            var admin = CurrentUser;
            if (admin == null || !admin.IsSuperAdmin)
                return StatusCode(403, new ApiResponse<List<ApiClientResponse>> { Success = false, Message = "Hanya SuperAdmin" });

            var list = await _context.ApiClients
                .Include(c => c.Organisasi)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            var response = list.Select(c => new ApiClientResponse
            {
                Id = c.Id,
                NamaWebsite = c.NamaWebsite,
                UrlWebsite = c.UrlWebsite,
                EmailKontak = c.EmailKontak,
                KeyPreview = c.KeyPreview,
                OrganisasiId = c.OrganisasiId,
                OrganisasiNama = c.Organisasi?.NamaOrganisasi ?? string.Empty,
                Aktif = c.Aktif,
                CreatedAt = c.CreatedAt,
                LastUsedAt = c.LastUsedAt,
                JumlahRequest = c.JumlahRequest
            }).ToList();

            return Ok(new ApiResponse<List<ApiClientResponse>>
            {
                Success = true,
                Message = "Data klien berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        /// <summary>Generate ulang API key untuk sebuah website (key lama otomatis mati).</summary>
        [HttpPost("clients/{id}/regenerate")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<RegisterSiteResponse>>> RegenerateKey(int id)
        {
            var admin = CurrentUser;
            if (admin == null || !admin.IsSuperAdmin)
                return StatusCode(403, new ApiResponse<RegisterSiteResponse> { Success = false, Message = "Hanya SuperAdmin" });

            var client = await _context.ApiClients.Include(c => c.Organisasi).FirstOrDefaultAsync(c => c.Id == id);
            if (client == null)
                return NotFound(new ApiResponse<RegisterSiteResponse> { Success = false, Message = "Klien tidak ditemukan" });

            var newKey = GenerateApiKey();
            client.KeyHash = HashKey(newKey);
            client.KeyPreview = newKey[..Math.Min(12, newKey.Length)] + "…";
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<RegisterSiteResponse>
            {
                Success = true,
                Message = "API key baru berhasil dibuat. Key lama otomatis tidak berlaku. SIMPAN SEKARANG — hanya ditampilkan sekali!",
                Data = new RegisterSiteResponse
                {
                    ClientId = client.Id,
                    NamaWebsite = client.NamaWebsite,
                    OrganisasiId = client.OrganisasiId,
                    OrganisasiNama = client.Organisasi?.NamaOrganisasi ?? string.Empty,
                    ApiKey = newKey,
                    CreatedAt = DateTime.UtcNow
                }
            });
        }

        /// <summary>Nonaktifkan / aktifkan kembali akses sebuah website.</summary>
        [HttpPut("clients/{id}/status")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> SetClientStatus(int id, [FromBody] UpdateAktifRequest request)
        {
            var admin = CurrentUser;
            if (admin == null || !admin.IsSuperAdmin)
                return StatusCode(403, new ApiResponse<string> { Success = false, Message = "Hanya SuperAdmin" });

            var client = await _context.ApiClients.FindAsync(id);
            if (client == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Klien tidak ditemukan" });

            client.Aktif = request.Aktif;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = request.Aktif ? "Website diaktifkan kembali" : "Website dinonaktifkan (API key ditolak sementara)",
                Data = $"Klien {client.NamaWebsite} -> Aktif={client.Aktif}"
            });
        }

        /// <summary>Hapus permanen klien website (tenant-nya tidak ikut terhapus).</summary>
        [HttpDelete("clients/{id}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> DeleteClient(int id)
        {
            var admin = CurrentUser;
            if (admin == null || !admin.IsSuperAdmin)
                return StatusCode(403, new ApiResponse<string> { Success = false, Message = "Hanya SuperAdmin" });

            var client = await _context.ApiClients.FindAsync(id);
            if (client == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Klien tidak ditemukan" });

            _context.ApiClients.Remove(client);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = "Klien website berhasil dihapus",
                Data = $"Klien {client.NamaWebsite} telah dihapus"
            });
        }
    }

    public class UpdateAktifRequest
    {
        public bool Aktif { get; set; }
    }
}
