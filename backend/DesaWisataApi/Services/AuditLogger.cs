using System.Text.RegularExpressions;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Pencatat audit: menyimpan baris AuditLog untuk aksi penting admin.
    /// Pencatatan dibuat fire-and-forget yang aman: kegagalan log TIDAK boleh
    /// menggagalkan aksi utama, tapi tetap tampil di console.
    /// </summary>
    public static class AuditLogger
    {
        /// <summary>IP asli request (mendukung proxy X-Forwarded-For untuk logging).</summary>
        private static string GetIp(HttpContext? http)
        {
            if (http == null) return string.Empty;
            var fwd = http.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(fwd))
            {
                var first = fwd.Split(',')[0].Trim();
                if (IPAddressSafe.IsMatch(first)) return first;
            }
            return http.Connection.RemoteIpAddress?.ToString() ?? string.Empty;
        }

        private static readonly Regex IPAddressSafe = new(@"^[0-9a-fA-F:.]+$", RegexOptions.Compiled);

        /// <summary>Catat aksi. Aman dipanggil tanpa await (fire-and-forget) via .LogAsync wrapper.</summary>
        public static async Task LogAsync(
            AppDbContext context,
            HttpContext? http,
            int? userId,
            string email,
            string role,
            string aksi,
            string keterangan,
            string entitas,
            int? entitasId = null)
        {
            try
            {
                context.AuditLogs.Add(new AuditLog
                {
                    CreatedAt = DateTime.UtcNow,
                    UserId = userId,
                    Email = (email ?? string.Empty).Truncate(150),
                    Role = (role ?? string.Empty).Truncate(30),
                    Aksi = (aksi ?? string.Empty).Truncate(30),
                    Keterangan = (keterangan ?? string.Empty).Truncate(400),
                    Entitas = (entitas ?? string.Empty).Truncate(30),
                    EntitasId = entitasId,
                    IpAddress = GetIp(http).Truncate(50),
                });
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Audit gagal tidak boleh merusak aksi utama
                Console.WriteLine($"[AUDIT] Gagal mencatat log '{aksi}': {ex.Message}");
            }
        }

        private static string Truncate(this string s, int max) =>
            string.IsNullOrEmpty(s) ? s : s.Length <= max ? s : s[..max];
    }
}
