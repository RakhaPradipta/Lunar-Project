using System.Text.RegularExpressions;
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
    /// Pustaka lagu YouTube untuk musik latar — dikelola admin (CRUD).
    /// GET publik untuk klien web (MusicPlayer &amp; halaman pengaturan);
    /// tulis (POST/PUT/DELETE) khusus SuperAdmin / admin organisasi pusat Id=1
    /// karena pustaka lagu bersifat global untuk seluruh platform.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class MusicLibraryController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MusicLibraryController(AppDbContext context) => _context = context;

        public record SongDto(
            int Id, string Judul, string Artis, string VideoId,
            string Deskripsi, int Urutan, bool Aktif, DateTime CreatedAt, string UpdatedBy);

        private static SongDto ToDto(Song s) =>
            new(s.Id, s.Judul, s.Artis, s.VideoId, s.Deskripsi, s.Urutan, s.Aktif, s.CreatedAt, s.UpdatedBy);

        // Regex ID video YouTube: 11 karakter umumnya, tapi terima 5..20 agar longgar
        private static readonly Regex VideoIdRegex = new("^[A-Za-z0-9_-]{5,20}$", RegexOptions.Compiled);

        // Lagu bawaan — di-seed sekali bila tabel masih kosong
        private static readonly (string Judul, string Artis, string VideoId, string Deskripsi, int Urutan)[] Defaults =
        {
            ("Pompeii", "Bastille", "F90Cw4l-8NY", "Anthem dengan tepuk tangan & harmoni megah — semangat yang menenangkan", 1),
            ("Fix You", "Coldplay", "k4V3Mo61fJM", "Balada organ yang hangat — menenangkan hati seperti senja di desa", 2),
            ("Let Her Go", "Passenger", "RBumgq5yVrA", "Gitar akustik lembut — hening, penuh perenungan", 3),
            ("Riptide", "Vance Joy", "uJ_1HMAGb4k", "Ukulele ceria — ringan seperti angin pantai", 4),
        };

        // ===== GET PUBLIK =====

        /// <summary>Daftar lagu aktif untuk player (publik, tanpa login).</summary>
        [HttpGet]
        [AllowAnonymous]
        [EnableRateLimiting("public")]
        public async Task<ActionResult<IEnumerable<SongDto>>> GetAll([FromQuery] bool includeInactive = false)
        {
            var query = _context.Songs.AsQueryable();
            if (!includeInactive)
                query = query.Where(s => s.Aktif);
            var songs = await query
                .OrderBy(s => s.Urutan).ThenBy(s => s.Id)
                .ToListAsync();
            return Ok(songs.Select(ToDto));
        }

        // ===== CRUD ADMIN =====

        /// <summary>Tambah lagu baru ke pustaka.</summary>
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<SongDto>> Create([FromBody] SongCreateRequest req)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();
            if (!admin.IsSuperAdmin && admin.OrganisasiId != 1)
                return StatusCode(403, new { message = "Hanya SuperAdmin atau admin pusat yang dapat mengelola pustaka lagu." });

            var (error, videoId) = NormalizeVideoId(req.VideoId);
            if (error != null) return BadRequest(new { message = error });

            var judul = (req.Judul ?? "").Trim();
            if (judul.Length == 0) return BadRequest(new { message = "Judul lagu wajib diisi." });

            var maxUrutan = await _context.Songs.AnyAsync()
                ? await _context.Songs.MaxAsync(s => s.Urutan)
                : 0;

            var song = new Song
            {
                Judul = judul,
                Artis = (req.Artis ?? "").Trim(),
                VideoId = videoId,
                Deskripsi = (req.Deskripsi ?? "").Trim(),
                Urutan = req.Urutan ?? maxUrutan + 1,
                Aktif = req.Aktif ?? true,
                CreatedAt = DateTime.UtcNow,
                UpdatedBy = admin.Email,
            };
            _context.Songs.Add(song);
            await _context.SaveChangesAsync();

            _ = AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "SongCreate", $"Menambah lagu '{song.Judul} — {song.Artis}' ({song.VideoId}) ke pustaka musik",
                "Song", song.Id);

            return CreatedAtAction(nameof(GetAll), ToDto(song));
        }

        /// <summary>Ubah lagu pada pustaka.</summary>
        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] SongUpdateRequest req)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();
            if (!admin.IsSuperAdmin && admin.OrganisasiId != 1)
                return StatusCode(403, new { message = "Hanya SuperAdmin atau admin pusat yang dapat mengelola pustaka lagu." });

            var song = await _context.Songs.FindAsync(id);
            if (song == null) return NotFound(new { message = "Lagu tidak ditemukan." });

            if (req.VideoId != null)
            {
                var (error, videoId) = NormalizeVideoId(req.VideoId);
                if (error != null) return BadRequest(new { message = error });
                song.VideoId = videoId;
            }
            if (req.Judul != null)
            {
                var judul = req.Judul.Trim();
                if (judul.Length == 0) return BadRequest(new { message = "Judul lagu tidak boleh kosong." });
                song.Judul = judul;
            }
            if (req.Artis != null) song.Artis = req.Artis.Trim();
            if (req.Deskripsi != null) song.Deskripsi = req.Deskripsi.Trim();
            if (req.Urutan.HasValue) song.Urutan = req.Urutan.Value;
            if (req.Aktif.HasValue) song.Aktif = req.Aktif.Value;
            song.UpdatedBy = admin.Email;

            await _context.SaveChangesAsync();

            _ = AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "SongUpdate", $"Mengubah lagu '{song.Judul} — {song.Artis}' ({song.VideoId})",
                "Song", song.Id);

            return Ok(ToDto(song));
        }

        /// <summary>Hapus lagu dari pustaka.</summary>
        [HttpDelete("{id:int}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();
            if (!admin.IsSuperAdmin && admin.OrganisasiId != 1)
                return StatusCode(403, new { message = "Hanya SuperAdmin atau admin pusat yang dapat mengelola pustaka lagu." });

            var song = await _context.Songs.FindAsync(id);
            if (song == null) return NotFound(new { message = "Lagu tidak ditemukan." });

            _context.Songs.Remove(song);
            await _context.SaveChangesAsync();

            _ = AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "SongDelete", $"Menghapus lagu '{song.Judul} — {song.Artis}' ({song.VideoId}) dari pustaka musik",
                "Song", id);

            return NoContent();
        }

        private static (string? Error, string VideoId) NormalizeVideoId(string? raw)
        {
            var input = (raw ?? "").Trim();
            if (input.Length == 0)
                return ("ID video YouTube wajib diisi.", "");

            // Terima URL lengkap (watch?v=, youtu.be/, shorts/, embed/) — ekstrak ID-nya
            var match = Regex.Match(input, @"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{5,20})");
            var id = match.Success ? match.Groups[1].Value : input;
            if (!VideoIdRegex.IsMatch(id))
                return ("ID video YouTube tidak valid. Masukkan ID (mis. F90Cw4l-8NY) atau URL video YouTube.", "");

            return (null, id);
        }
    }

    // Artis & Deskripsi opsional (default null) agar admin bisa menambah lagu tanpa mengisi keduanya
    public record SongCreateRequest(
        string Judul, string? Artis, string VideoId, string? Deskripsi, int? Urutan, bool? Aktif);

    public record SongUpdateRequest(
        string? Judul, string? Artis, string? VideoId, string? Deskripsi, int? Urutan, bool? Aktif);
}
