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
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly JwtService _jwt;
        private readonly TokenRevocationService _revocation;

        public AuthController(AppDbContext context, JwtService jwt, TokenRevocationService revocation)
        {
            _context = context;
            _jwt = jwt;
            _revocation = revocation;
        }

        // POST: api/Auth/login
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<ApiResponse<LoginResponse>>> Login([FromBody] LoginRequest request)
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _context.AdminUsers
                .Include(u => u.Organisasi)
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            // Pesan sama untuk email tidak ada & password salah (jangan bocorkan keberadaan email)
            if (user == null || !user.Aktif || !PasswordHasher.Verify(request.Password, user.PasswordHash))
            {
                // Audit: login gagal (anonim — jangan catat password, cukup email dicoba)
                await AuditLogger.LogAsync(_context, HttpContext, user?.Id, email, "Anonim",
                    "LoginFailed", $"Percobaan login gagal untuk email '{email}'", "Auth");
                return Unauthorized(new ApiResponse<LoginResponse>
                {
                    Success = false,
                    Message = "Email atau password salah!"
                });
            }

            var (token, expiresAt) = _jwt.CreateToken(user, user.Organisasi?.NamaOrganisasi);

            // Audit: login sukses
            await AuditLogger.LogAsync(_context, HttpContext, user.Id, user.Email, user.Role,
                "LoginSuccess", $"{user.NamaLengkap} ({user.Role}) berhasil login", "Auth", user.Id);

            return Ok(new ApiResponse<LoginResponse>
            {
                Success = true,
                Message = $"Login berhasil! Selamat datang {user.NamaLengkap}.",
                Data = new LoginResponse
                {
                    Token = token,
                    ExpiresAt = expiresAt,
                    UserId = user.Id,
                    Email = user.Email,
                    NamaLengkap = user.NamaLengkap,
                    Role = user.Role,
                    OrganisasiId = user.OrganisasiId,
                    OrganisasiNama = user.Organisasi?.NamaOrganisasi
                }
            });
        }

        // GET: api/Auth/me
        [HttpGet("me")]
        [Authorize]
        public ActionResult<ApiResponse<MeResponse>> Me()
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null)
                return Unauthorized(new ApiResponse<MeResponse> { Success = false, Message = "Token tidak valid" });

            string? orgNama = null;
            if (admin.OrganisasiId.HasValue)
            {
                orgNama = _context.Organisasi
                    .Where(o => o.Id == admin.OrganisasiId.Value)
                    .Select(o => o.NamaOrganisasi)
                    .FirstOrDefault();
            }

            return Ok(new ApiResponse<MeResponse>
            {
                Success = true,
                Message = "Data user berhasil diambil",
                Data = new MeResponse
                {
                    UserId = admin.UserId,
                    Email = admin.Email,
                    NamaLengkap = admin.NamaLengkap,
                    Role = admin.Role,
                    OrganisasiId = admin.OrganisasiId,
                    OrganisasiNama = orgNama
                }
            });
        }

        // POST: api/Auth/logout
        // Logout server-side: jti token dimasukkan blacklist sehingga token yang sama
        // tidak bisa dipakai lagi walaupun belum kedaluwarsa (mis. dicuri dari client).
        [HttpPost("logout")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> Logout()
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "Token tidak valid" });

            var jti = User.FindFirst("jti")?.Value;
            if (!string.IsNullOrEmpty(jti))
            {
                var expiresAt = DateTimeOffset.UtcNow.AddMinutes(12 * 60); // fallback: maks usia token
                var expClaim = User.FindFirst("exp")?.Value;
                if (long.TryParse(expClaim, out var expUnix))
                    expiresAt = DateTimeOffset.FromUnixTimeSeconds(expUnix);
                _revocation.Revoke(jti, expiresAt);
            }

            // Audit: logout
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "Logout", $"{admin.NamaLengkap} logout (token direvoke)", "Auth", admin.UserId);

            return Ok(new ApiResponse<string> { Success = true, Message = "Logout berhasil", Data = "OK" });
        }

        // POST: api/Auth/change-password
        [HttpPost("change-password")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<string>>> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "Token tidak valid" });

            var user = await _context.AdminUsers.FindAsync(admin.UserId);
            if (user == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "User tidak ditemukan" });

            if (!PasswordHasher.Verify(request.PasswordLama, user.PasswordHash))
                return BadRequest(new ApiResponse<string> { Success = false, Message = "Password lama salah" });

            user.PasswordHash = PasswordHasher.Hash(request.PasswordBaru);
            await _context.SaveChangesAsync();

            // Audit: ganti password
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, user.Email, admin.Role,
                "PasswordChanged", "Password berhasil diganti", "Auth", user.Id);

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = "Password berhasil diubah",
                Data = "OK"
            });
        }

        // POST: api/Auth/reset-password
        // Reset password akun lain — khusus SuperAdmin. Mengisi celah "lupa password":
        // admin yang lupa passwordnya dapat direset oleh SuperAdmin tanpa akses DB langsung.
        public record ResetPasswordRequest(string Email, string PasswordBaru);

        [HttpPost("reset-password")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<string>>> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null)
                return Unauthorized(new ApiResponse<string> { Success = false, Message = "Token tidak valid" });

            var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
            var passwordBaru = request.PasswordBaru ?? string.Empty;

            if (passwordBaru.Length < 6)
                return BadRequest(new ApiResponse<string> { Success = false, Message = "Password baru minimal 6 karakter" });

            var user = await _context.AdminUsers.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            if (user == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "User tidak ditemukan" });

            // Cegah SuperAdmin mengunci dirinya sendiri keluar
            if (user.Id == admin.UserId)
                return BadRequest(new ApiResponse<string> { Success = false, Message = "Gunakan menu Ganti Password untuk mengubah password akun sendiri" });

            user.PasswordHash = PasswordHasher.Hash(passwordBaru);
            await _context.SaveChangesAsync();

            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "PasswordReset", $"Password akun '{user.Email}' direset oleh SuperAdmin", "Auth", user.Id);

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = $"Password akun {user.Email} berhasil direset",
                Data = "OK"
            });
        }
    }
}
