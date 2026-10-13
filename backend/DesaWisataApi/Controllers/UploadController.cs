using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DesaWisataApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;

        public UploadController(IWebHostEnvironment env)
        {
            _env = env;
        }

        // Ekstensi yang diizinkan — SVG SENGAJA DILARANG karena bisa membawa <script> (stored XSS)
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

        [HttpPost]
        [Authorize]
        public async Task<ActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { success = false, message = "Tidak ada file yang diunggah" });

            // Validasi ekstensi file (bukan cuma ContentType, yang mudah dipalsukan)
            var extension = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
                return BadRequest(new { success = false, message = "Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP" });

            // Defense-in-depth: cek juga MIME yang diklaim browser
            var allowedMime = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedMime.Contains(file.ContentType))
                return BadRequest(new { success = false, message = "Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP" });

            // Magic bytes: pastikan file benar-benar gambar (bukan .exe yang di-rename .jpg)
            if (!await HasImageHeaderAsync(file))
                return BadRequest(new { success = false, message = "Isi file bukan gambar yang valid" });

            // Max 5MB
            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { success = false, message = "Ukuran file maksimal 5MB" });

            var uploadsPath = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath);

            // Nama file SELALU digenerate server (GUID) — nama asli user tidak pernah dipakai,
            // sehingga tidak ada jalur path traversal lewat nama file.
            // Ekstensi dipaksa Whitelist (tanpa titik/separator dari input user).
            var safeExt = extension.ToLowerInvariant();
            var fileName = $"{Guid.NewGuid():N}{safeExt}";
            var filePath = Path.Combine(uploadsPath, fileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var fileUrl = $"/uploads/{fileName}";

            return Ok(new
            {
                success = true,
                message = "File berhasil diunggah",
                data = new
                {
                    url = fileUrl,
                    fileName = fileName,
                    originalName = Path.GetFileName(file.FileName),
                    size = file.Length
                }
            });
        }

        [HttpDelete("{fileName}")]
        [Authorize]
        public ActionResult DeleteFile(string fileName)
        {
            // ===== ANTI PATH-TRAVERSAL =====
            // 1. Tolak karakter berbahaya apa pun
            if (string.IsNullOrWhiteSpace(fileName) ||
                fileName.Contains('/') || fileName.Contains('\\') ||
                fileName.Contains("..") ||
                fileName != Path.GetFileName(fileName))
            {
                return BadRequest(new { success = false, message = "Nama file tidak valid" });
            }

            // 2. Nama harus pola GUID-hex + ekstensi whitelist (yang pernah di-generate server)
            var name = Path.GetFileName(fileName);
            if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^[0-9a-f]{32}\.(jpg|jpeg|png|gif|webp)$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                return BadRequest(new { success = false, message = "Nama file tidak valid" });
            }

            // 3. Path final harus tetap di dalam folder uploads (double check)
            var uploadsRoot = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "uploads"));
            var filePath = Path.GetFullPath(Path.Combine(uploadsRoot, name));
            if (!filePath.StartsWith(uploadsRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                return BadRequest(new { success = false, message = "Nama file tidak valid" });
            }

            if (!System.IO.File.Exists(filePath))
                return NotFound(new { success = false, message = "File tidak ditemukan" });

            System.IO.File.Delete(filePath);
            return Ok(new { success = true, message = "File berhasil dihapus" });
        }

        /// <summary>Cek magic bytes file: JPEG (FFD8FF), PNG (89504E47), GIF (474946), WebP (RIFF....WEBP).</summary>
        private static async Task<bool> HasImageHeaderAsync(IFormFile file)
        {
            await using var stream = file.OpenReadStream();
            var header = new byte[12];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length));
            stream.Position = 0;
            if (read < 4) return false;

            if (header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return true; // JPEG
            if (header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47) return true; // PNG
            if (header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46) return true; // GIF
            if (read >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50) return true; // WEBP
            return false;
        }
    }
}
