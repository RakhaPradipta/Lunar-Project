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
    [ApiController]
    [Route("api/[controller]")]
    public class DesaWisataController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DesaWisataController(AppDbContext context)
        {
            _context = context;
        }

        private CurrentAdmin? CurrentUser => CurrentAdmin.FromPrincipal(User);

        /// <summary>Apakah admin ini boleh mengelola desa tsb? SuperAdmin boleh semua; Admin hanya desa organisasinya.</summary>
        private static bool CanManage(CurrentAdmin admin, DesaWisata desa) =>
            admin.IsSuperAdmin || (admin.OrganisasiId.HasValue && desa.OrganisasiId == admin.OrganisasiId.Value);

        private static DesaWisataResponse MapToResponse(DesaWisata d) => new DesaWisataResponse
        {
            Id = d.Id,
            NamaDesa = d.NamaDesa,
            Kecamatan = d.Kecamatan,
            Kabupaten = d.Kabupaten,
            Provinsi = d.Provinsi,
            Deskripsi = d.Deskripsi,
            Lokasi = d.Lokasi,
            UrlGambar = d.UrlGambar,
            UrlWebsite = d.UrlWebsite,
            UrlFoto = d.UrlFoto,
            UrlVideo = d.UrlVideo,
            Rating = d.Rating,
            JumlahWisatawan = d.JumlahWisatawan,
            Kategori = d.Kategori,
            Aktif = d.Aktif,
            Latitude = d.Latitude,
            Longitude = d.Longitude,

            // Overtourism
            BatasPengunjung = d.BatasPengunjung,
            PengunjungHariIni = d.PengunjungHariIni,
            Overtourism = d.Overtourism,
            ThresholdPeringatan = d.ThresholdPeringatan,
            AutoLockOvertourism = d.AutoLockOvertourism,
            PesanPeringatan = d.PesanPeringatan,

            // Operational
            StatusOperasional = d.StatusOperasional,
            JamBuka = d.JamBuka,
            JamTutup = d.JamTutup,
            HariOperasional = d.HariOperasional,

            // Contact
            KontakPengelola = d.KontakPengelola,
            EmailPengelola = d.EmailPengelola,
            SocialMedia = d.SocialMedia,

            // Pricing
            HargaTiketLokal = d.HargaTiketLokal,
            HargaTiketMancanegara = d.HargaTiketMancanegara,
            HargaParkirMotor = d.HargaParkirMotor,
            HargaParkirMobil = d.HargaParkirMobil,

            // Pajak daerah
            PersenPajakDaerah = d.PersenPajakDaerah,

            // Facilities
            Fasilitas = d.Fasilitas,

            // Multi-tenant
            OrganisasiId = d.OrganisasiId,
            OrganisasiNama = d.Organisasi?.NamaOrganisasi ?? string.Empty,

            CreatedAt = d.CreatedAt,
            UpdatedAt = d.UpdatedAt
        };

        private async Task<DesaWisataResponse> MapToResponseAsync(DesaWisata d)
        {
            var res = MapToResponse(d);
            res.GaleriFoto = await _context.DesaFotos
                .Where(f => f.DesaWisataId == d.Id)
                .OrderBy(f => f.Urutan).ThenBy(f => f.Id)
                .Select(f => new DesaFotoResponse
                {
                    Id = f.Id,
                    DesaWisataId = f.DesaWisataId,
                    Url = f.Url,
                    Judul = f.Judul,
                    Urutan = f.Urutan
                })
                .ToListAsync();
            return res;
        }

        private static DesaFotoResponse MapFoto(DesaFoto f) => new DesaFotoResponse
        {
            Id = f.Id,
            DesaWisataId = f.DesaWisataId,
            Url = f.Url,
            Judul = f.Judul,
            Tipe = f.Tipe,
            Urutan = f.Urutan
        };

        /// <summary>Apakah URL galeri valid (harus http(s) atau file /uploads lokal).</summary>
        private static bool IsValidFotoUrl(string url) =>
            url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase);

        /// <summary>
        /// Anti-XSS: URL yang dirender sebagai href/src HANYA boleh http(s) atau /uploads.
        /// Memblok javascript:, data:, vbscript:, dan skema lain yang bisa dieksekusi browser.
        /// </summary>
        private static string SanitizeUrl(string? url)
        {
            var u = url?.Trim() ?? string.Empty;
            if (u.Length == 0) return string.Empty;
            if (u.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) return u;
            if (u.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("http://", StringComparison.OrdinalIgnoreCase)) return u;
            return string.Empty; // skema lain (javascript:, data:, dsb.) dibuang
        }

        /// <summary>Terapkan sanitasi ke semua field URL desa sebelum disimpan.</summary>
        private static void SanitizeDesaUrls(DesaWisata d)
        {
            d.UrlWebsite = SanitizeUrl(d.UrlWebsite);
            d.UrlFoto = SanitizeUrl(d.UrlFoto);
            d.UrlVideo = SanitizeUrl(d.UrlVideo);
            d.UrlGambar = SanitizeUrl(d.UrlGambar);
            d.SocialMedia = SanitizeUrl(d.SocialMedia);
        }

        /// <summary>Apakah URL adalah video dari platform yang didukung (YouTube/TikTok/Instagram).</summary>
        private static bool IsValidVideoUrl(string url) =>
            url.Contains("youtube.com/", StringComparison.OrdinalIgnoreCase)
            || url.Contains("youtu.be/", StringComparison.OrdinalIgnoreCase)
            || url.Contains("tiktok.com/", StringComparison.OrdinalIgnoreCase)
            || url.Contains("instagram.com/", StringComparison.OrdinalIgnoreCase)
            || url.Contains("instagr.am/", StringComparison.OrdinalIgnoreCase);

        private async Task FillOrganisasiAsync(DesaWisata d)
        {
            if (d.Organisasi == null)
                d.Organisasi = await _context.Organisasi.FindAsync(d.OrganisasiId);
        }

        private static PengunjungResponse MapToPengunjungResponse(Pengunjung p) => new PengunjungResponse
        {
            Id = p.Id,
            DesaWisataId = p.DesaWisataId,
            NomorKarcis = p.NomorKarcis,
            NamaWisatawan = p.NamaWisatawan,
            KategoriTiket = p.KategoriTiket,
            CheckInAt = p.CheckInAt,
            CheckOutAt = p.CheckOutAt
        };

        private static PemesananResponse MapToPemesananResponse(Pemesanan p) => new PemesananResponse
        {
            Id = p.Id,
            DesaWisataId = p.DesaWisataId,
            NomorBooking = p.NomorBooking,
            NamaWisatawan = p.NamaWisatawan,
            KategoriTiket = p.KategoriTiket,
            TanggalBooking = p.TanggalBooking,
            TanggalKunjungan = p.TanggalKunjungan,
            UrlFoto = p.UrlFoto,
            Status = p.Status,
            CheckInAt = p.CheckInAt,
            PengunjungId = p.PengunjungId
        };

        // GET: api/DesaWisata
        // Publik. Admin yang login dapat memakai ?mine=true untuk melihat hanya desa
        // milik organisasinya (tenant scoping).
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<DesaWisataResponse>>>> GetAll(
            [FromQuery] string? provinsi,
            [FromQuery] string? kategori,
            [FromQuery] string? search,
            [FromQuery] bool? aktif,
            [FromQuery] bool mine = false)
        {
            var query = _context.DesaWisata.Include(d => d.Organisasi).AsQueryable();

            if (mine)
            {
                var admin = CurrentUser;
                if (admin == null)
                    return Unauthorized(new ApiResponse<List<DesaWisataResponse>> { Success = false, Message = "Login diperlukan" });
                if (!admin.IsSuperAdmin)
                    query = query.Where(d => d.OrganisasiId == admin.OrganisasiId);
            }

            if (!string.IsNullOrEmpty(provinsi))
                query = query.Where(d => d.Provinsi.Contains(provinsi));
            if (!string.IsNullOrEmpty(kategori))
                query = query.Where(d => d.Kategori == kategori);
            if (!string.IsNullOrEmpty(search))
                query = query.Where(d => d.NamaDesa.Contains(search) || d.Deskripsi.Contains(search));
            if (aktif.HasValue)
                query = query.Where(d => d.Aktif == aktif.Value);

            var data = await query.OrderByDescending(d => d.CreatedAt).ToListAsync();

            // Galeri foto per desa diisi batch (1 query) agar list dipakai untuk
            // edit modal/admin juga membawa galeri lengkap.
            var desaIds = data.Select(d => d.Id).ToList();
            var allFotos = await _context.DesaFotos
                .Where(f => desaIds.Contains(f.DesaWisataId))
                .OrderBy(f => f.Urutan).ThenBy(f => f.Id)
                .ToListAsync();

            var response = data.Select(d =>
            {
                var r = MapToResponse(d);
                r.GaleriFoto = allFotos
                    .Where(f => f.DesaWisataId == d.Id)
                    .Select(MapFoto)
                    .ToList();
                return r;
            }).ToList();

            return Ok(new ApiResponse<List<DesaWisataResponse>>
            {
                Success = true,
                Message = "Data berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // GET: api/DesaWisata/5
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<DesaWisataResponse>>> GetById(int id)
        {
            var d = await _context.DesaWisata.Include(x => x.Organisasi).FirstOrDefaultAsync(x => x.Id == id);
            if (d == null)
                return NotFound(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            return Ok(new ApiResponse<DesaWisataResponse>
            {
                Success = true,
                Message = "Data berhasil diambil",
                Data = await MapToResponseAsync(d)
            });
        }

        // POST: api/DesaWisata
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DesaWisataResponse>>> Create([FromBody] CreateDesaWisataRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Data tidak valid" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Login diperlukan" });

            // Tenant: Admin organisasi selalu membuat desa di organisasinya sendiri.
            // SuperAdmin boleh menentukan organisasi tujuan via request.OrganisasiId.
            var orgId = admin.IsSuperAdmin
                ? (request.OrganisasiId ?? admin.OrganisasiId ?? 1)
                : admin.OrganisasiId ?? 1;
            if (!await _context.Organisasi.AnyAsync(o => o.Id == orgId))
                return BadRequest(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Organisasi tujuan tidak ditemukan" });

            var desa = new DesaWisata
            {
                NamaDesa = request.NamaDesa,
                Kecamatan = request.Kecamatan,
                Kabupaten = request.Kabupaten,
                Provinsi = request.Provinsi,
                Deskripsi = request.Deskripsi,
                Lokasi = request.Lokasi,
                UrlGambar = request.UrlGambar,
                UrlWebsite = request.UrlWebsite,
                UrlFoto = request.UrlFoto,
                UrlVideo = request.UrlVideo,
                Rating = request.Rating,
                JumlahWisatawan = request.JumlahWisatawan,
                Kategori = request.Kategori,
                Aktif = request.Aktif,
                Latitude = request.Latitude,
                Longitude = request.Longitude,

                // Overtourism
                BatasPengunjung = request.BatasPengunjung,
                PengunjungHariIni = request.PengunjungHariIni,
                Overtourism = (request.BatasPengunjung > 0 && request.PengunjungHariIni >= request.BatasPengunjung) || request.Overtourism,
                ThresholdPeringatan = request.ThresholdPeringatan,
                AutoLockOvertourism = request.AutoLockOvertourism,
                PesanPeringatan = request.PesanPeringatan,

                // Operational
                StatusOperasional = request.StatusOperasional,
                JamBuka = request.JamBuka,
                JamTutup = request.JamTutup,
                HariOperasional = request.HariOperasional,

                // Contact
                KontakPengelola = request.KontakPengelola,
                EmailPengelola = request.EmailPengelola,
                SocialMedia = request.SocialMedia,

                // Pricing
                HargaTiketLokal = request.HargaTiketLokal,
                HargaTiketMancanegara = request.HargaTiketMancanegara,
                HargaParkirMotor = request.HargaParkirMotor,
                HargaParkirMobil = request.HargaParkirMobil,
                PersenPajakDaerah = Math.Clamp(request.PersenPajakDaerah, 0, 100),

                // Facilities
                Fasilitas = request.Fasilitas,

                // Multi-tenant
                OrganisasiId = orgId,

                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.DesaWisata.Add(desa);
            SanitizeDesaUrls(desa); // anti-XSS: buang javascript:/data: URL sebelum simpan
            await _context.SaveChangesAsync();
            await FillOrganisasiAsync(desa);

            // Audit: desa dibuat
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "DesaCreate", $"Menambahkan desa '{desa.NamaDesa}'", "DesaWisata", desa.Id);

            return CreatedAtAction(nameof(GetById), new { id = desa.Id }, new ApiResponse<DesaWisataResponse>
            {
                Success = true,
                Message = "Desa wisata berhasil ditambahkan",
                Data = await MapToResponseAsync(desa)
            });
        }

        // PUT: api/DesaWisata/5
        [HttpPut("{id}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DesaWisataResponse>>> Update(int id, [FromBody] UpdateDesaWisataRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(admin, desa))
                return StatusCode(403, new ApiResponse<DesaWisataResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            // Hanya SuperAdmin boleh memindahkan desa ke organisasi lain.
            // Admin non-super yang mencoba memindahkan desa mendapat 403 eksplisit
            // (bukan diabaikan diam-diam) agar client tidak bingung.
            if (request.OrganisasiId.HasValue && request.OrganisasiId.Value != desa.OrganisasiId)
            {
                if (!admin.IsSuperAdmin)
                    return StatusCode(403, new ApiResponse<DesaWisataResponse> { Success = false, Message = "Hanya SuperAdmin yang dapat memindahkan desa ke organisasi lain" });

                if (!await _context.Organisasi.AnyAsync(o => o.Id == request.OrganisasiId.Value))
                    return BadRequest(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Organisasi tujuan tidak ditemukan" });
                desa.OrganisasiId = request.OrganisasiId.Value;
            }

            if (request.NamaDesa != null) desa.NamaDesa = request.NamaDesa;
            if (request.Kecamatan != null) desa.Kecamatan = request.Kecamatan;
            if (request.Kabupaten != null) desa.Kabupaten = request.Kabupaten;
            if (request.Provinsi != null) desa.Provinsi = request.Provinsi;
            if (request.Deskripsi != null) desa.Deskripsi = request.Deskripsi;
            if (request.Lokasi != null) desa.Lokasi = request.Lokasi;
            if (request.UrlGambar != null) desa.UrlGambar = request.UrlGambar;
            if (request.UrlWebsite != null) desa.UrlWebsite = request.UrlWebsite;
            if (request.UrlFoto != null) desa.UrlFoto = request.UrlFoto;
            if (request.UrlVideo != null) desa.UrlVideo = request.UrlVideo;
            if (request.Rating.HasValue) desa.Rating = request.Rating.Value;
            if (request.JumlahWisatawan.HasValue) desa.JumlahWisatawan = request.JumlahWisatawan.Value;
            if (request.Kategori != null) desa.Kategori = request.Kategori;
            if (request.Aktif.HasValue) desa.Aktif = request.Aktif.Value;
            if (request.Latitude.HasValue) desa.Latitude = request.Latitude.Value;
            if (request.Longitude.HasValue) desa.Longitude = request.Longitude.Value;

            // Overtourism
            if (request.BatasPengunjung.HasValue) desa.BatasPengunjung = request.BatasPengunjung.Value;
            if (request.PengunjungHariIni.HasValue) desa.PengunjungHariIni = request.PengunjungHariIni.Value;
            if (request.ThresholdPeringatan.HasValue) desa.ThresholdPeringatan = request.ThresholdPeringatan.Value;
            if (request.AutoLockOvertourism.HasValue) desa.AutoLockOvertourism = request.AutoLockOvertourism.Value;
            if (request.PesanPeringatan != null) desa.PesanPeringatan = request.PesanPeringatan;

            // Auto-check overtourism
            if (desa.BatasPengunjung > 0)
            {
                desa.Overtourism = desa.PengunjungHariIni >= desa.BatasPengunjung;
            }
            if (request.Overtourism.HasValue) desa.Overtourism = request.Overtourism.Value;

            // Operational
            if (request.StatusOperasional != null) desa.StatusOperasional = request.StatusOperasional;
            if (request.JamBuka != null) desa.JamBuka = request.JamBuka;
            if (request.JamTutup != null) desa.JamTutup = request.JamTutup;
            if (request.HariOperasional != null) desa.HariOperasional = request.HariOperasional;

            // Contact
            if (request.KontakPengelola != null) desa.KontakPengelola = request.KontakPengelola;
            if (request.EmailPengelola != null) desa.EmailPengelola = request.EmailPengelola;
            if (request.SocialMedia != null) desa.SocialMedia = request.SocialMedia;

            // Pricing
            if (request.HargaTiketLokal.HasValue) desa.HargaTiketLokal = request.HargaTiketLokal.Value;
            if (request.HargaTiketMancanegara.HasValue) desa.HargaTiketMancanegara = request.HargaTiketMancanegara.Value;
            if (request.HargaParkirMotor.HasValue) desa.HargaParkirMotor = request.HargaParkirMotor.Value;
            if (request.HargaParkirMobil.HasValue) desa.HargaParkirMobil = request.HargaParkirMobil.Value;
            if (request.PersenPajakDaerah.HasValue) desa.PersenPajakDaerah = Math.Clamp(request.PersenPajakDaerah.Value, 0, 100);

            // Facilities
            if (request.Fasilitas != null) desa.Fasilitas = request.Fasilitas;

            SanitizeDesaUrls(desa); // anti-XSS: buang javascript:/data: URL sebelum simpan
            desa.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await FillOrganisasiAsync(desa);

            // Audit: desa diubah
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "DesaUpdate", $"Mengubah desa '{desa.NamaDesa}'", "DesaWisata", desa.Id);

            return Ok(new ApiResponse<DesaWisataResponse>
            {
                Success = true,
                Message = "Desa wisata berhasil diperbarui",
                Data = await MapToResponseAsync(desa)
            });
        }

        // DELETE: api/DesaWisata/5
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> Delete(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(admin, desa))
                return StatusCode(403, new ApiResponse<string> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            _context.DesaWisata.Remove(desa);
            await _context.SaveChangesAsync();

            // Audit: desa dihapus (catat SETELAH save — desa hilang tapi log tetap)
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "DesaDelete", $"MENGHAPUS desa '{desa.NamaDesa}' beserta seluruh datanya", "DesaWisata", desa.Id);

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = "Desa wisata berhasil dihapus",
                Data = $"Desa {desa.NamaDesa} telah dihapus"
            });
        }

        // GET: api/DesaWisata/{id}/fotos -> galeri foto desa (publik)
        [HttpGet("{id}/fotos")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<DesaFotoResponse>>>> GetFotos(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<List<DesaFotoResponse>> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var fotos = await _context.DesaFotos
                .Where(f => f.DesaWisataId == id)
                .OrderBy(f => f.Urutan).ThenBy(f => f.Id)
                .Select(f => new DesaFotoResponse
                {
                    Id = f.Id,
                    DesaWisataId = f.DesaWisataId,
                    Url = f.Url,
                    Judul = f.Judul,
                    Tipe = f.Tipe,
                    Urutan = f.Urutan
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<DesaFotoResponse>>
            {
                Success = true,
                Message = "Galeri foto berhasil diambil",
                Data = fotos,
                TotalData = fotos.Count
            });
        }

        // GET: api/DesaWisata/{id}/forecast -> perkiraan keramaian 7 hari ke depan (publik)
        // Model sederhana berbasis pola mingguan: hari ini memakai angka live, hari lain =
        // baseline (rata-rata historis) x faktor hari (akhir pekan lebih ramai) + variasi deterministik.
        // Nama hari dalam Bahasa Indonesia — dipetakan manual agar TIDAK tergantung
        // culture server (dulu DateTime.ToString("dddd") menghasilkan "Friday" saat
        // culture server bukan id-ID, padahal field-nya untuk UI berbahasa Indonesia).
        private static readonly string[] NamaHariIndonesia =
        {
            "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
        };

        [HttpGet("{id}/forecast")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<ForecastHariResponse>>>> GetForecast(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<List<ForecastHariResponse>> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var result = new List<ForecastHariResponse>();
            var baseLevel = desa.BatasPengunjung > 0 ? (double)desa.PengunjungHariIni / desa.BatasPengunjung : 0;
            var threshold = desa.ThresholdPeringatan > 0 ? desa.ThresholdPeringatan / 100.0 : 0.8;

            for (int i = 0; i < 7; i++)
            {
                var tanggal = DateTime.Today.AddDays(i);
                double level;
                if (i == 0)
                {
                    level = baseLevel; // hari ini: data real-time
                }
                else
                {
                    // Faktor hari dalam seminggu: Minggu/Sabtu lebih ramai, Senin–Kamal sedang
                    double dayFactor = tanggal.DayOfWeek switch
                    {
                        DayOfWeek.Sunday => 1.35,
                        DayOfWeek.Saturday => 1.3,
                        DayOfWeek.Friday => 1.1,
                        DayOfWeek.Monday => 0.85,
                        _ => 0.9,
                    };
                    // Variasi deterministik per desa+tanggal (bukan acak murni agar stabil antar-refresh)
                    var seed = (desa.Id * 1000) + tanggal.DayOfYear;
                    double wiggle = 0.9 + ((seed * 2654435761 % 100) / 100.0 * 0.2); // ±10%
                    level = baseLevel * dayFactor * wiggle;
                }

                var persen = Math.Clamp((int)Math.Round(level * 100), 0, 130);
                var status = persen >= 100 ? "Penuh"
                    : persen >= (int)(threshold * 100) ? "Ramai"
                    : persen >= 45 ? "Sedang"
                    : "Lengang";

                result.Add(new ForecastHariResponse
                {
                    Tanggal = tanggal.ToString("yyyy-MM-dd"),
                    Hari = NamaHariIndonesia[(int)tanggal.DayOfWeek],
                    Persen = persen,
                    Status = status,
                });
            }

            return Ok(new ApiResponse<List<ForecastHariResponse>>
            {
                Success = true,
                Message = "Prakiraan keramaian berhasil diambil",
                Data = result,
                TotalData = result.Count
            });
        }

        // POST: api/DesaWisata/{id}/fotos -> tambah foto ke galeri (butuh login + tenant check)
        [HttpPost("{id}/fotos")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DesaFotoResponse>>> AddFoto(int id, [FromBody] DesaFotoRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<DesaFotoResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<DesaFotoResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(admin, desa))
                return StatusCode(403, new ApiResponse<DesaFotoResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var url = request?.Url?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(url))
                return BadRequest(new ApiResponse<DesaFotoResponse> { Success = false, Message = "URL foto wajib diisi" });
            if (!IsValidFotoUrl(url))
                return BadRequest(new ApiResponse<DesaFotoResponse> { Success = false, Message = "URL foto tidak valid. Gunakan tautan http(s) atau hasil unggah /uploads" });
            if (url.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase) || url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new ApiResponse<DesaFotoResponse> { Success = false, Message = "URL tidak diizinkan" });

            var urutan = request.Urutan
                ?? await _context.DesaFotos.Where(f => f.DesaWisataId == id).MaxAsync(f => (int?)f.Urutan) + 1
                ?? 0;

            var tipe = (request.Tipe ?? "foto").Trim().ToLowerInvariant() == "video" ? "video" : "foto";
            if (tipe == "video" && !IsValidVideoUrl(url))
                return BadRequest(new ApiResponse<DesaFotoResponse> { Success = false, Message = "URL video harus dari YouTube, TikTok, atau Instagram" });

            var foto = new DesaFoto
            {
                DesaWisataId = id,
                Url = url,
                Judul = request.Judul?.Trim() ?? string.Empty,
                Tipe = tipe,
                Urutan = urutan,
                CreatedAt = DateTime.UtcNow
            };
            _context.DesaFotos.Add(foto);

            desa.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Audit: item galeri ditambahkan
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                tipe == "video" ? "VideoAdd" : "FotoAdd",
                $"Menambah {(tipe == "video" ? "video" : "foto")} '{(string.IsNullOrEmpty(foto.Judul) ? foto.Url : foto.Judul)}' ke galeri '{desa.NamaDesa}'",
                "DesaFoto", foto.Id);

            return Ok(new ApiResponse<DesaFotoResponse>
            {
                Success = true,
                Message = tipe == "video" ? "Video berhasil ditambahkan ke galeri" : "Foto berhasil ditambahkan ke galeri",
                Data = new DesaFotoResponse
                {
                    Id = foto.Id,
                    DesaWisataId = foto.DesaWisataId,
                    Url = foto.Url,
                    Judul = foto.Judul,
                    Tipe = foto.Tipe,
                    Urutan = foto.Urutan
                }
            });
        }

        // PUT: api/DesaWisata/{id}/fotos/{fotoId} -> ubah judul/urutan foto
        [HttpPut("{id}/fotos/{fotoId}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DesaFotoResponse>>> UpdateFoto(int id, int fotoId, [FromBody] DesaFotoRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<DesaFotoResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<DesaFotoResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(admin, desa))
                return StatusCode(403, new ApiResponse<DesaFotoResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var foto = await _context.DesaFotos.FirstOrDefaultAsync(f => f.Id == fotoId && f.DesaWisataId == id);
            if (foto == null)
                return NotFound(new ApiResponse<DesaFotoResponse> { Success = false, Message = "Foto tidak ditemukan" });

            if (request.Judul != null) foto.Judul = request.Judul.Trim();
            if (request.Tipe != null)
            {
                var tipe = request.Tipe.Trim().ToLowerInvariant() == "video" ? "video" : "foto";
                if (tipe == "video" && !IsValidVideoUrl(foto.Url))
                    return BadRequest(new ApiResponse<DesaFotoResponse> { Success = false, Message = "URL video harus dari YouTube, TikTok, atau Instagram" });
                foto.Tipe = tipe;
            }
            if (request.Urutan.HasValue) foto.Urutan = request.Urutan.Value;

            desa.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<DesaFotoResponse>
            {
                Success = true,
                Message = "Item galeri berhasil diperbarui",
                Data = new DesaFotoResponse
                {
                    Id = foto.Id,
                    DesaWisataId = foto.DesaWisataId,
                    Url = foto.Url,
                    Judul = foto.Judul,
                    Tipe = foto.Tipe,
                    Urutan = foto.Urutan
                }
            });
        }

        // DELETE: api/DesaWisata/{id}/fotos/{fotoId} -> hapus foto dari galeri
        [HttpDelete("{id}/fotos/{fotoId}")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> DeleteFoto(int id, int fotoId)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var admin = CurrentUser;
            if (admin == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(admin, desa))
                return StatusCode(403, new ApiResponse<string> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var foto = await _context.DesaFotos.FirstOrDefaultAsync(f => f.Id == fotoId && f.DesaWisataId == id);
            if (foto == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Foto tidak ditemukan" });

            // Hapus juga file fisiknya bila berasal dari unggahan /uploads (bukan URL eksternal).
            // URL bisa berupa "/uploads/x.png" (relatif) atau "http://host/uploads/x.png"
            // (dengan prefix API base dari frontend) -> cari penanda "/uploads/" di mana pun.
            var uploadsMarker = "/uploads/";
            var markerIdx = foto.Url.IndexOf(uploadsMarker, StringComparison.OrdinalIgnoreCase);
            if (markerIdx >= 0)
            {
                var fileName = Path.GetFileName(foto.Url.Substring(markerIdx + uploadsMarker.Length));
                if (!string.IsNullOrEmpty(fileName))
                {
                    var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
                    var filePath = Path.Combine(uploadsPath, fileName);
                    if (System.IO.File.Exists(filePath))
                    {
                        try { System.IO.File.Delete(filePath); } catch { /* abaikan kegagalan hapus file */ }
                    }
                }
            }

            _context.DesaFotos.Remove(foto);
            desa.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Audit: item galeri dihapus
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                foto.Tipe == "video" ? "VideoDelete" : "FotoDelete",
                $"Menghapus {(foto.Tipe == "video" ? "video" : "foto")} '{(string.IsNullOrEmpty(foto.Judul) ? foto.Url : foto.Judul)}' dari galeri '{desa.NamaDesa}'",
                "DesaFoto", foto.Id);

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = "Foto berhasil dihapus dari galeri",
                Data = $"Foto {foto.Id} telah dihapus"
            });
        }

        // POST: api/DesaWisata/{id}/checkin
        [HttpPost("{id}/checkin")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<VisitorActionResponse>>> CheckIn(int id, [FromBody] CheckInRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<VisitorActionResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var adminCheckin = CurrentUser;
            if (adminCheckin == null)
                return Unauthorized(new ApiResponse<VisitorActionResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(adminCheckin, desa))
                return StatusCode(403, new ApiResponse<VisitorActionResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            // Jika NomorBooking diisi, check-in ini = konfirmasi kedatangan booking tertunda
            // (wisatawan yang sudah memesan tapi belum ada di lokasi). Data wisatawan diambil
            // dari booking tersebut, sehingga baru dihitung setelah benar-benar tiba di desa.
            var nomorBooking = request?.NomorBooking?.Trim() ?? string.Empty;
            Pemesanan? pemesanan = null;
            if (!string.IsNullOrEmpty(nomorBooking))
            {
                pemesanan = await _context.Pemesanan
                    .FirstOrDefaultAsync(p => p.DesaWisataId == id && p.NomorBooking == nomorBooking);
                if (pemesanan == null)
                    return BadRequest(new ApiResponse<VisitorActionResponse>
                    {
                        Success = false,
                        Message = "Kode booking tidak ditemukan untuk desa ini. Periksa kembali nomor bookingnya."
                    });
                if (pemesanan.Status == "Hadir")
                    return BadRequest(new ApiResponse<VisitorActionResponse>
                    {
                        Success = false,
                        Message = $"Booking {pemesanan.NomorBooking} sudah dikonfirmasi kedatangannya (wisatawan sudah di dalam desa)."
                    });
            }

            var nama = request?.NamaWisatawan?.Trim() ?? string.Empty;
            var kategori = string.IsNullOrWhiteSpace(request?.KategoriTiket) ? "Lokal" : request!.KategoriTiket.Trim();
            if (kategori != "Mancanegara") kategori = "Lokal";

            // Saat check-in lewat nomor booking, nama & kategori mengikuti data booking
            if (pemesanan != null)
            {
                nama = pemesanan.NamaWisatawan;
                kategori = pemesanan.KategoriTiket;
            }

            if (string.IsNullOrEmpty(nama))
                return BadRequest(new ApiResponse<VisitorActionResponse>
                {
                    Success = false,
                    Message = "Nama wisatawan wajib diisi untuk check-in (atau isi nomor booking)"
                });

            if (desa.AutoLockOvertourism && desa.BatasPengunjung > 0 && desa.PengunjungHariIni >= desa.BatasPengunjung)
            {
                return BadRequest(new ApiResponse<VisitorActionResponse>
                {
                    Success = false,
                    Message = desa.PesanPeringatan,
                    Data = new VisitorActionResponse { Desa = MapToResponse(desa) }
                });
            }

            // Urutan karcis harian untuk desa ini, mis. T-001-20260903-0001
            // Hari dihitung dalam WIB (UTC+7) agar nomor reset tepat tengah malam waktu Indonesia,
            // bukan pukul 07:00 WIB (perilaku lama memakai tanggal UTC).
            var (startOfDayUtc, endOfDayUtc) = WibTime.TodayUtcRange;
            var nomorHariIni = await _context.Pengunjung
                .CountAsync(p => p.DesaWisataId == id && p.CheckInAt >= startOfDayUtc && p.CheckInAt < endOfDayUtc);
            var nomorKarcis = $"T-{desa.Id:D3}-{WibTime.Today:yyyyMMdd}-{nomorHariIni + 1:D4}";

            var pengunjung = new Pengunjung
            {
                DesaWisataId = desa.Id,
                NomorKarcis = nomorKarcis,
                NamaWisatawan = nama,
                KategoriTiket = kategori,
                CheckInAt = DateTime.UtcNow
            };
            _context.Pengunjung.Add(pengunjung);

            desa.PengunjungHariIni += 1;
            desa.JumlahWisatawan += 1;
            if (desa.BatasPengunjung > 0)
            {
                desa.Overtourism = desa.PengunjungHariIni >= desa.BatasPengunjung;
            }
            desa.UpdatedAt = DateTime.UtcNow;

            // Anti-duplikat nomor karcis: dua check-in bersamaan bisa menghitung nomor sama
            // (count -> save). Bila terjadi, ulangi dengan nomor berikutnya (maks 5 kali).
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException) when (attempt < 5)
                {
                    var nomorBaru = await _context.Pengunjung
                        .CountAsync(p => p.DesaWisataId == id && p.CheckInAt >= startOfDayUtc && p.CheckInAt < endOfDayUtc);
                    pengunjung.NomorKarcis = $"T-{desa.Id:D3}-{WibTime.Today:yyyyMMdd}-{nomorBaru + 1:D4}";
                }
            }

            // Konfirmasi kedatangan: booking tertunda -> Hadir (terhubung ke karcis yang baru diterbitkan)
            var dariBooking = false;
            if (pemesanan != null)
            {
                pemesanan.Status = "Hadir";
                pemesanan.CheckInAt = pengunjung.CheckInAt;
                pemesanan.PengunjungId = pengunjung.Id;
                dariBooking = true;
                await _context.SaveChangesAsync();
            }

            // Audit: check-in wisatawan
            var adminCi = CurrentUser;
            await AuditLogger.LogAsync(_context, HttpContext, adminCi?.UserId, adminCi?.Email ?? string.Empty, adminCi?.Role ?? string.Empty,
                "PengunjungCheckIn", $"Check-in {nama} di '{desa.NamaDesa}'" + (dariBooking ? $" (booking {pemesanan!.NomorBooking})" : string.Empty),
                "Pengunjung", pengunjung.Id);

            return Ok(new ApiResponse<VisitorActionResponse>
            {
                Success = true,
                Message = dariBooking
                    ? $"Check-in berhasil! Booking {pemesanan!.NomorBooking} dikonfirmasi - {nama} kini berada di dalam desa."
                    : desa.Overtourism ? "Peringatan: Desa sudah mencapai batas maksimal kapasitas!" : "Check-in berhasil",
                Data = new VisitorActionResponse
                {
                    Desa = MapToResponse(desa),
                    Pengunjung = MapToPengunjungResponse(pengunjung)
                }
            });
        }

        // POST: api/DesaWisata/{id}/checkout  -> check-out berdasarkan nomor karcis / nomor wisatawan
        [HttpPost("{id}/checkout")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<VisitorActionResponse>>> CheckOut(int id, [FromBody] CheckOutRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<VisitorActionResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var adminCheckout = CurrentUser;
            if (adminCheckout == null)
                return Unauthorized(new ApiResponse<VisitorActionResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(adminCheckout, desa))
                return StatusCode(403, new ApiResponse<VisitorActionResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var nomor = request?.NomorKarcis?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(nomor))
                return BadRequest(new ApiResponse<VisitorActionResponse> { Success = false, Message = "Nomor karcis wajib diisi untuk check-out" });

            var pengunjung = await _context.Pengunjung
                .Where(p => p.DesaWisataId == id && p.CheckOutAt == null)
                .FirstOrDefaultAsync(p => p.NomorKarcis == nomor || p.Id.ToString() == nomor);
            if (pengunjung == null)
                return BadRequest(new ApiResponse<VisitorActionResponse>
                {
                    Success = false,
                    Message = "Karcis tidak ditemukan atau wisatawan sudah check-out. Periksa kembali nomor karcisnya."
                });

            pengunjung.CheckOutAt = DateTime.UtcNow;

            if (desa.PengunjungHariIni > 0)
            {
                desa.PengunjungHariIni -= 1;
            }
            if (desa.BatasPengunjung > 0)
            {
                desa.Overtourism = desa.PengunjungHariIni >= desa.BatasPengunjung;
            }
            desa.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Audit: check-out wisatawan
            var adminCo = CurrentUser;
            await AuditLogger.LogAsync(_context, HttpContext, adminCo?.UserId, adminCo?.Email ?? string.Empty, adminCo?.Role ?? string.Empty,
                "PengunjungCheckOut", $"Check-out {pengunjung.NamaWisatawan} (karcis {pengunjung.NomorKarcis}) dari '{desa.NamaDesa}'",
                "Pengunjung", pengunjung.Id);

            return Ok(new ApiResponse<VisitorActionResponse>
            {
                Success = true,
                Message = $"Check-out berhasil untuk {pengunjung.NamaWisatawan} (karcis {pengunjung.NomorKarcis})",
                Data = new VisitorActionResponse
                {
                    Desa = MapToResponse(desa),
                    Pengunjung = MapToPengunjungResponse(pengunjung)
                }
            });
        }

        // GET: api/DesaWisata/{id}/pengunjung -> wisatawan yang sedang berada di dalam
        [HttpGet("{id}/pengunjung")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<List<PengunjungResponse>>>> GetActiveVisitors(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<List<PengunjungResponse>> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var adminVis = CurrentUser;
            if (adminVis == null)
                return Unauthorized(new ApiResponse<List<PengunjungResponse>> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(adminVis, desa))
                return StatusCode(403, new ApiResponse<List<PengunjungResponse>> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var list = await _context.Pengunjung
                .Where(p => p.DesaWisataId == id && p.CheckOutAt == null)
                .OrderByDescending(p => p.CheckInAt)
                .ToListAsync();
            var response = list.Select(MapToPengunjungResponse).ToList();

            return Ok(new ApiResponse<List<PengunjungResponse>>
            {
                Success = true,
                Message = "Data wisatawan berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // GET: api/DesaWisata/aktivitas -> feed masuk/keluar seluruh desa (real-time, untuk notifikasi)
        // Publik untuk landing page; admin yang login dengan ?mine=true hanya melihat desa organisasinya.
        [HttpGet("aktivitas")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<VisitorActivityResponse>>>> GetGlobalVisitorActivity([FromQuery] bool mine = false)
        {
            var query = _context.Pengunjung.Include(p => p.DesaWisata).AsQueryable();
            var isAdminRequest = false;
            if (mine)
            {
                var admin = CurrentUser;
                if (admin == null)
                    return Unauthorized(new ApiResponse<List<VisitorActivityResponse>> { Success = false, Message = "Login diperlukan" });
                if (!admin.IsSuperAdmin)
                    query = query.Where(p => p.DesaWisata != null && p.DesaWisata.OrganisasiId == admin.OrganisasiId);
                isAdminRequest = true; // admin login: nama tidak perlu disamarkan
            }

            var list = await query
                .OrderByDescending(p => p.CheckInAt)
                .Take(100)
                .Select(p => new VisitorActivityResponse
                {
                    Id = p.Id,
                    DesaWisataId = p.DesaWisataId,
                    NamaDesa = p.DesaWisata != null ? p.DesaWisata.NamaDesa : string.Empty,
                    NomorKarcis = p.NomorKarcis,
                    NamaWisatawan = isAdminRequest ? p.NamaWisatawan : MaskNama(p.NamaWisatawan), // publik: disamarkan
                    KategoriTiket = p.KategoriTiket,
                    CheckInAt = p.CheckInAt,
                    CheckOutAt = p.CheckOutAt
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<VisitorActivityResponse>>
            {
                Success = true,
                Message = "Aktivitas wisatawan real-time berhasil diambil",
                Data = list,
                TotalData = list.Count
            });
        }

        /// <summary>
        /// Anti-PII-leak: endpoint aktivitas bersifat publik, jadi nama wisatawan disamarkan
        /// (mis. "Budi Santoso" -> "Budi S***"). Admin tetap melihat nama penuh lewat
        /// endpoint yang butuh login (check-in/check-out, daftar pengunjung).
        /// </summary>
        private static string MaskNama(string nama)
        {
            var parts = (nama ?? string.Empty).Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return string.Empty;
            if (parts.Length == 1) return parts[0].Length <= 2 ? parts[0] : parts[0][..2] + "***";
            return parts[0] + " " + parts[^1][0] + "***";
        }

        // GET: api/DesaWisata/{id}/aktivitas -> riwayat masuk/keluar wisatawan (real-time)
        [HttpGet("{id}/aktivitas")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<PengunjungResponse>>>> GetVisitorActivity(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<List<PengunjungResponse>> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var list = await _context.Pengunjung
                .Where(p => p.DesaWisataId == id)
                .OrderByDescending(p => p.CheckInAt)
                .Take(100)
                .ToListAsync();
            var response = list.Select(p =>
            {
                var r = MapToPengunjungResponse(p);
                r.NamaWisatawan = MaskNama(p.NamaWisatawan); // publik: nama disamarkan
                return r;
            }).ToList();

            return Ok(new ApiResponse<List<PengunjungResponse>>
            {
                Success = true,
                Message = "Riwayat masuk/keluar wisatawan berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // POST: api/DesaWisata/{id}/pemesanan -> buat booking kunjungan.
        // Booking berstatus "Tertunda": TIDAK menyentuh PengunjungHariIni / JumlahWisatawan,
        // jadi wisatawan yang sudah memesan tapi belum ada di lokasi belum terhitung.
        [HttpPost("{id}/pemesanan")]
        [AllowAnonymous]
        [EnableRateLimiting("booking")]
        public async Task<ActionResult<ApiResponse<PemesananResponse>>> CreatePemesanan(int id, [FromBody] PemesananRequest request)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<PemesananResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            if (desa.StatusOperasional == "Tutup Sementara")
                return BadRequest(new ApiResponse<PemesananResponse>
                {
                    Success = false,
                    Message = "Desa sedang tutup sementara, belum bisa menerima booking. Mohon berkunjung di waktu lain."
                });

            var nama = request?.NamaWisatawan?.Trim() ?? string.Empty;
            var kategori = string.IsNullOrWhiteSpace(request?.KategoriTiket) ? "Lokal" : request!.KategoriTiket.Trim();
            if (kategori != "Mancanegara") kategori = "Lokal";

            if (string.IsNullOrEmpty(nama))
                return BadRequest(new ApiResponse<PemesananResponse> { Success = false, Message = "Nama wisatawan wajib diisi untuk booking" });

            var tanggalKunjungan = request?.TanggalKunjungan;
            if (tanggalKunjungan == null || tanggalKunjungan.Value == default)
                return BadRequest(new ApiResponse<PemesananResponse> { Success = false, Message = "Tanggal kunjungan wajib diisi untuk booking" });
            if (tanggalKunjungan.Value.Date < DateTime.Today)
                return BadRequest(new ApiResponse<PemesananResponse> { Success = false, Message = "Tanggal kunjungan tidak boleh di masa lalu" });

            // Urutan booking harian untuk desa ini, mis. B-001-20260904-0001 (hari WIB, bukan UTC)
            var (startOfDayUtc, endOfDayUtc) = WibTime.TodayUtcRange;
            var nomorHariIni = await _context.Pemesanan
                .CountAsync(b => b.DesaWisataId == id && b.TanggalBooking >= startOfDayUtc && b.TanggalBooking < endOfDayUtc);
            var nomorBooking = $"B-{desa.Id:D3}-{WibTime.Today:yyyyMMdd}-{nomorHariIni + 1:D4}";

            var pemesanan = new Pemesanan
            {
                DesaWisataId = desa.Id,
                NomorBooking = nomorBooking,
                NamaWisatawan = nama,
                KategoriTiket = kategori,
                TanggalBooking = DateTime.UtcNow,
                TanggalKunjungan = tanggalKunjungan.Value,
                // Anti-XSS: input publik — hanya http(s) atau /uploads yang diterima,
                // skema berbahaya (javascript:, data:, dsb.) dibuang sebelum disimpan.
                UrlFoto = SanitizeUrl(request?.UrlFoto),
                Status = "Tertunda"
            };
            _context.Pemesanan.Add(pemesanan);

            // Anti-duplikat nomor booking: retry dengan nomor berikutnya bila tabrakan
            // (dua booking bersamaan menghitung nomor sama).
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateException) when (attempt < 5)
                {
                    var nomorBaru = await _context.Pemesanan
                        .CountAsync(b => b.DesaWisataId == id && b.TanggalBooking >= startOfDayUtc && b.TanggalBooking < endOfDayUtc);
                    pemesanan.NomorBooking = $"B-{desa.Id:D3}-{WibTime.Today:yyyyMMdd}-{nomorBaru + 1:D4}";
                }
            }

            return Ok(new ApiResponse<PemesananResponse>
            {
                Success = true,
                Message = "Booking berhasil! Simpan kode booking dan tunjukkan saat tiba di lokasi. Status: tertunda (belum dihitung sampai wisatawan tiba).",
                Data = MapToPemesananResponse(pemesanan)
            });
        }

        // GET: api/DesaWisata/{id}/pemesanan?status=Tertunda -> daftar booking desa
        [HttpGet("{id}/pemesanan")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<List<PemesananResponse>>>> GetPemesanan(int id, [FromQuery] string? status)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<List<PemesananResponse>> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var adminPem = CurrentUser;
            if (adminPem == null)
                return Unauthorized(new ApiResponse<List<PemesananResponse>> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(adminPem, desa))
                return StatusCode(403, new ApiResponse<List<PemesananResponse>> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            var query = _context.Pemesanan.Where(p => p.DesaWisataId == id);
            if (!string.IsNullOrEmpty(status))
                query = query.Where(p => p.Status == status);

            var list = await query
                .OrderBy(p => p.TanggalKunjungan)
                .ThenByDescending(p => p.TanggalBooking)
                .ToListAsync();
            var response = list.Select(MapToPemesananResponse).ToList();

            return Ok(new ApiResponse<List<PemesananResponse>>
            {
                Success = true,
                Message = "Data booking wisatawan berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // POST: api/DesaWisata/{id}/reset-visitors
        [HttpPost("{id}/reset-visitors")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<DesaWisataResponse>>> ResetVisitors(int id)
        {
            var desa = await _context.DesaWisata.FindAsync(id);
            if (desa == null)
                return NotFound(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Desa wisata tidak ditemukan" });

            var adminReset = CurrentUser;
            if (adminReset == null)
                return Unauthorized(new ApiResponse<DesaWisataResponse> { Success = false, Message = "Login diperlukan" });
            if (!CanManage(adminReset, desa))
                return StatusCode(403, new ApiResponse<DesaWisataResponse> { Success = false, Message = "Desa ini bukan milik organisasi Anda" });

            // Tutup semua karcis yang masih aktif agar daftar wisatawan tetap konsisten
            var aktif = await _context.Pengunjung
                .Where(p => p.DesaWisataId == id && p.CheckOutAt == null)
                .ToListAsync();
            var now = DateTime.UtcNow;
            foreach (var p in aktif)
            {
                p.CheckOutAt = now;
            }

            desa.PengunjungHariIni = 0;
            desa.Overtourism = false;
            desa.UpdatedAt = now;

            await _context.SaveChangesAsync();

            // Audit: reset pengunjung (aksi sensitif)
            await AuditLogger.LogAsync(_context, HttpContext, adminReset.UserId, adminReset.Email, adminReset.Role,
                "ResetVisitors", $"Reset pengunjung '{desa.NamaDesa}' ({aktif.Count} karcis ditutup)", "DesaWisata", desa.Id);

            return Ok(new ApiResponse<DesaWisataResponse>
            {
                Success = true,
                Message = $"Pengunjung hari ini direset ({aktif.Count} wisatawan di-check-out)",
                Data = MapToResponse(desa)
            });
        }

        // GET: api/DesaWisata/stats
        // Publik untuk landing page; admin yang login dengan ?mine=true mendapat statistik
        // hanya dari desa milik organisasinya (tenant scoping).
        [HttpGet("stats")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<object>>> GetStats([FromQuery] bool mine = false)
        {
            var query = _context.DesaWisata.AsQueryable();
            if (mine)
            {
                var admin = CurrentUser;
                if (admin == null)
                    return Unauthorized(new ApiResponse<object> { Success = false, Message = "Login diperlukan" });
                if (!admin.IsSuperAdmin)
                    query = query.Where(d => d.OrganisasiId == admin.OrganisasiId);
            }

            var totalDesa = await query.CountAsync();
            var desaAktif = await query.CountAsync(d => d.Aktif);
            var totalWisatawan = await query.SumAsync(d => d.JumlahWisatawan);
            var totalPengunjungHariIni = await query.SumAsync(d => d.PengunjungHariIni);
            var desaOvertourism = await query.CountAsync(d => d.Overtourism);
            var totalPemesananTertunda = await _context.Pemesanan
                .Where(p => query.Any(d => d.Id == p.DesaWisataId) && p.Status == "Tertunda")
                .CountAsync();
            var kategoriCounts = await query
                .GroupBy(d => d.Kategori)
                .Select(g => new { Kategori = g.Key, Jumlah = g.Count() })
                .ToListAsync();
            var provinsiCounts = await query
                .GroupBy(d => d.Provinsi)
                .Select(g => new { Provinsi = g.Key, Jumlah = g.Count() })
                .ToListAsync();

            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Statistik berhasil diambil",
                Data = new
                {
                    TotalDesa = totalDesa,
                    DesaAktif = desaAktif,
                    TotalWisatawan = totalWisatawan,
                    TotalPengunjungHariIni = totalPengunjungHariIni,
                    DesaOvertourism = desaOvertourism,
                    TotalPemesananTertunda = totalPemesananTertunda,
                    KategoriCounts = kategoriCounts,
                    ProvinsiCounts = provinsiCounts
                }
            });
        }
    }
}
