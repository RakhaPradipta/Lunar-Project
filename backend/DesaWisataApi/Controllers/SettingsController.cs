using System.Text.Json;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using DesaWisataApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Controllers
{
    /// <summary>
    /// Pengaturan situs yang dikendalikan admin (mis. musik latar).
    /// GET publik untuk klien web; PUT khusus admin (SuperAdmin / Admin organisasi pusat Id=1
    /// karena musik bersifat global untuk seluruh platform).
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SettingsController(AppDbContext context) => _context = context;

        public record MusicSettingsDto(
            bool Enabled,
            string Track,
            double Volume,
            bool Autoplay,
            string Mode,
            string? Title,
            string? UpdatedBy,
            DateTime? UpdatedAt);

        private const string MusicKey = "music";

        // Nilai default — dipakai bila belum pernah diubah admin
        private static readonly MusicSettingsDto DefaultMusic = new(
            Enabled: true, Track: "pompeii", Volume: 0.35, Autoplay: true,
            Mode: "youtube", Title: "Pompeii — Bastille",
            UpdatedBy: null, UpdatedAt: null);

        // Track prosedural yang diizinkan (disintesis di browser, tanpa file audio)
        private static readonly HashSet<string> AllowedProcedural = new(StringComparer.OrdinalIgnoreCase)
        { "ambient", "gamelan", "sundanese", "laut" };

        // Alias legacy: pengaturan lama menyimpan id lagu ("pompeii" dll.),
        // sekarang track disimpan sebagai VideoId YouTube.
        private static readonly Dictionary<string, string> LegacyTrackToVideo = new(StringComparer.OrdinalIgnoreCase)
        {
            ["pompeii"] = "F90Cw4l-8NY",
            ["fixyou"] = "k4V3Mo61fJM",
            ["lethergo"] = "RBumgq5yVrA",
            ["riptide"] = "uJ_1HMAGb4k",
        };

        // ===== GET PUBLIK =====

        /// <summary>Pengaturan musik latar (publik — dibaca widget MusicPlayer di web publik).</summary>
        [HttpGet("music")]
        [AllowAnonymous]
        [EnableRateLimiting("public")]
        public async Task<ActionResult<MusicSettingsDto>> GetMusic()
        {
            var entity = await _context.AppSettings.FindAsync(MusicKey);
            if (entity == null || string.IsNullOrWhiteSpace(entity.Value))
                return Ok(DefaultMusic);

            try
            {
                var dto = JsonSerializer.Deserialize<MusicSettingsDto>(entity.Value,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (dto == null) return Ok(DefaultMusic);

                // Kembalikan metadata siapa yang terakhir mengubah (dari entity)
                return Ok(new MusicSettingsDto(
                    dto.Enabled, dto.Track, dto.Volume, dto.Autoplay, dto.Mode,
                    dto.Title, entity.UpdatedBy, entity.UpdatedAt));
            }
            catch
            {
                return Ok(DefaultMusic);
            }
        }

        // ===== PUT ADMIN =====

        /// <summary>Ubah pengaturan musik latar. Hanya SuperAdmin atau Admin organisasi pusat (Id=1).</summary>
        [HttpPut("music")]
        [Authorize]
        public async Task<IActionResult> UpdateMusic([FromBody] MusicUpdateRequest req)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();

            // Musik bersifat global: hanya SuperAdmin / admin pusat yang boleh mengubah
            if (!admin.IsSuperAdmin && admin.OrganisasiId != 1)
                return StatusCode(403, new { message = "Hanya SuperAdmin atau admin pusat yang dapat mengubah pengaturan musik." });

            var mode = (req.Mode ?? "youtube").Trim().ToLowerInvariant();
            if (mode != "youtube" && mode != "procedural")
                return BadRequest(new { message = "Mode hanya mendukung 'youtube' (lagu healing via IFrame API) atau 'procedural' (musik disintesis di browser)." });

            string track;
            if (mode == "procedural")
            {
                track = (req.Track ?? "ambient").Trim().ToLowerInvariant();
                if (!AllowedProcedural.Contains(track))
                    return BadRequest(new { message = "Track tidak dikenal. Pilihan: ambient, gamelan, sundanese, laut." });
            }
            else
            {
                // LAGU DARI PUSTAKA (fix bug whitelist): dulu hanya 4 lagu hardcoded yang
                // diterima, padahal admin bebas menambah lagu via /api/MusicLibrary —
                // lagu baru selalu ditolak. Sekarang validasi melawan tabel Songs.
                var raw = (req.Track ?? string.Empty).Trim();
                var videoId = LegacyTrackToVideo.TryGetValue(raw, out var mapped) ? mapped : raw;

                var ada = await _context.Songs
                    .AnyAsync(s => s.VideoId == videoId && s.Aktif);
                if (!ada)
                    return BadRequest(new { message = "Lagu tidak ditemukan di pustaka atau sedang nonaktif. Tambahkan dulu di menu Musik Latar." });
                track = videoId;
            }
            var volume = Math.Clamp(req.Volume, 0.0, 1.0);

            var dto = new MusicSettingsDto(
                Enabled: req.Enabled, Track: track, Volume: volume,
                Autoplay: req.Autoplay, Mode: mode,
                Title: (req.Title ?? DefaultMusic.Title)?.Trim() ?? DefaultMusic.Title,
                UpdatedBy: admin.Email, UpdatedAt: DateTime.UtcNow);

            var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions
            {
                // Simpan hanya field pengaturan (buang metadata audit dari input)
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            var entity = await _context.AppSettings.FindAsync(MusicKey);
            if (entity == null)
            {
                _context.AppSettings.Add(new AppSetting
                {
                    Key = MusicKey,
                    Value = json,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = admin.Email
                });
            }
            else
            {
                entity.Value = json;
                entity.UpdatedAt = DateTime.UtcNow;
                entity.UpdatedBy = admin.Email;
            }
            await _context.SaveChangesAsync();

            // Catat audit (fire-and-forget yang aman)
            _ = AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "SettingsMusic", $"Pengaturan musik latar diubah: enabled={dto.Enabled}, track={dto.Track}, volume={dto.Volume:0.##}, autoplay={dto.Autoplay}",
                "AppSetting", null);

            return Ok(dto);
        }

        public record MusicUpdateRequest(
            bool Enabled, string Track, double Volume, bool Autoplay, string Mode, string? Title);
    }
}
