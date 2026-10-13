using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using DesaWisataApi.DTOs;
using DesaWisataApi.Services;

namespace DesaWisataApi.Controllers
{
    /// <summary>
    /// Endpoint manajemen tenant (organisasi) & akun admin.
    /// Semua endpoint di sini butuh login. Menulis (create/update/delete) hanya SuperAdmin;
    /// Admin organisasi hanya boleh melihat organisasinya sendiri.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrganisasiController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OrganisasiController(AppDbContext context)
        {
            _context = context;
        }

        private static OrganisasiResponse MapToResponse(Organisasi o, int jumlahDesa, int jumlahAdmin) =>
            new OrganisasiResponse
            {
                Id = o.Id,
                NamaOrganisasi = o.NamaOrganisasi,
                Deskripsi = o.Deskripsi,
                Kontak = o.Kontak,
                Email = o.Email,
                Aktif = o.Aktif,
                JumlahDesa = jumlahDesa,
                JumlahAdmin = jumlahAdmin,
                CreatedAt = o.CreatedAt
            };

        // GET: api/Organisasi
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<OrganisasiResponse>>>> GetAll()
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();

            var query = _context.Organisasi.AsQueryable();
            if (!admin.IsSuperAdmin)
                query = query.Where(o => o.Id == admin.OrganisasiId);

            var list = await query.OrderBy(o => o.Id).ToListAsync();
            var desaCounts = await _context.DesaWisata
                .GroupBy(d => d.OrganisasiId)
                .Select(g => new { OrgId = g.Key, Jumlah = g.Count() })
                .ToDictionaryAsync(x => x.OrgId, x => x.Jumlah);
            var adminCounts = await _context.AdminUsers
                .Where(u => u.OrganisasiId != null)
                .GroupBy(u => u.OrganisasiId!.Value)
                .Select(g => new { OrgId = g.Key, Jumlah = g.Count() })
                .ToDictionaryAsync(x => x.OrgId, x => x.Jumlah);

            var response = list
                .Select(o => MapToResponse(o, desaCounts.GetValueOrDefault(o.Id), adminCounts.GetValueOrDefault(o.Id)))
                .ToList();

            return Ok(new ApiResponse<List<OrganisasiResponse>>
            {
                Success = true,
                Message = "Data organisasi berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // GET: api/Organisasi/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<OrganisasiResponse>>> GetById(int id)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();

            if (!admin.IsSuperAdmin && admin.OrganisasiId != id)
                return StatusCode(403, new ApiResponse<OrganisasiResponse> { Success = false, Message = "Anda tidak punya akses ke organisasi ini" });

            var o = await _context.Organisasi.FindAsync(id);
            if (o == null)
                return NotFound(new ApiResponse<OrganisasiResponse> { Success = false, Message = "Organisasi tidak ditemukan" });

            var jumlahDesa = await _context.DesaWisata.CountAsync(d => d.OrganisasiId == id);
            var jumlahAdmin = await _context.AdminUsers.CountAsync(u => u.OrganisasiId == id);

            return Ok(new ApiResponse<OrganisasiResponse>
            {
                Success = true,
                Message = "Data organisasi berhasil diambil",
                Data = MapToResponse(o, jumlahDesa, jumlahAdmin)
            });
        }

        // POST: api/Organisasi
        [HttpPost]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<OrganisasiResponse>>> Create([FromBody] CreateOrganisasiRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new ApiResponse<OrganisasiResponse> { Success = false, Message = "Data tidak valid" });

            var organisasi = new Organisasi
            {
                NamaOrganisasi = request.NamaOrganisasi.Trim(),
                Deskripsi = request.Deskripsi?.Trim() ?? string.Empty,
                Kontak = request.Kontak?.Trim() ?? string.Empty,
                Email = request.Email?.Trim() ?? string.Empty,
                Aktif = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Organisasi.Add(organisasi);
            await _context.SaveChangesAsync(); // simpan dulu agar organisasi.Id ter-generate

            // Opsional: buat akun admin pertama organisasi ini sekaligus
            AdminUser? newAdmin = null;
            var adminEmail = request.AdminEmail?.Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(adminEmail))
            {
                if (string.IsNullOrWhiteSpace(request.AdminPassword) || request.AdminPassword.Length < 6)
                    return BadRequest(new ApiResponse<OrganisasiResponse>
                    {
                        Success = false,
                        Message = "Password admin organisasi wajib diisi (minimal 6 karakter)"
                    });
                if (await _context.AdminUsers.AnyAsync(u => u.Email.ToLower() == adminEmail))
                    return BadRequest(new ApiResponse<OrganisasiResponse>
                    {
                        Success = false,
                        Message = $"Email {adminEmail} sudah dipakai akun lain"
                    });

                newAdmin = new AdminUser
                {
                    Email = adminEmail,
                    PasswordHash = PasswordHasher.Hash(request.AdminPassword),
                    NamaLengkap = request.AdminNama?.Trim() ?? request.NamaOrganisasi,
                    Role = "Admin",
                    OrganisasiId = organisasi.Id,
                    Aktif = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.AdminUsers.Add(newAdmin);
                await _context.SaveChangesAsync();
            }

            // Audit: organisasi dibuat
            var adminCreate = CurrentAdmin.FromPrincipal(User);
            await AuditLogger.LogAsync(_context, HttpContext, adminCreate?.UserId, adminCreate?.Email ?? string.Empty, adminCreate?.Role ?? string.Empty,
                "OrgCreate", $"Membuat organisasi '{organisasi.NamaOrganisasi}'" + (newAdmin != null ? $" + admin {newAdmin.Email}" : string.Empty),
                "Organisasi", organisasi.Id);

            return CreatedAtAction(nameof(GetById), new { id = organisasi.Id }, new ApiResponse<OrganisasiResponse>
            {
                Success = true,
                Message = newAdmin != null
                    ? $"Organisasi berhasil dibuat beserta akun admin {newAdmin.Email}"
                    : "Organisasi berhasil dibuat",
                Data = MapToResponse(organisasi, 0, newAdmin != null ? 1 : 0)
            });
        }

        // PUT: api/Organisasi/5
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<OrganisasiResponse>>> Update(int id, [FromBody] UpdateOrganisasiRequest request)
        {
            var o = await _context.Organisasi.FindAsync(id);
            if (o == null)
                return NotFound(new ApiResponse<OrganisasiResponse> { Success = false, Message = "Organisasi tidak ditemukan" });

            if (request.NamaOrganisasi != null) o.NamaOrganisasi = request.NamaOrganisasi.Trim();
            if (request.Deskripsi != null) o.Deskripsi = request.Deskripsi.Trim();
            if (request.Kontak != null) o.Kontak = request.Kontak.Trim();
            if (request.Email != null) o.Email = request.Email.Trim();
            if (request.Aktif.HasValue) o.Aktif = request.Aktif.Value;

            await _context.SaveChangesAsync();

            // Audit: organisasi diubah
            var adminUpdate = CurrentAdmin.FromPrincipal(User);
            await AuditLogger.LogAsync(_context, HttpContext, adminUpdate?.UserId, adminUpdate?.Email ?? string.Empty, adminUpdate?.Role ?? string.Empty,
                "OrgUpdate", $"Mengubah organisasi '{o.NamaOrganisasi}'", "Organisasi", o.Id);

            var jumlahDesa = await _context.DesaWisata.CountAsync(d => d.OrganisasiId == id);
            var jumlahAdmin = await _context.AdminUsers.CountAsync(u => u.OrganisasiId == id);

            return Ok(new ApiResponse<OrganisasiResponse>
            {
                Success = true,
                Message = "Organisasi berhasil diperbarui",
                Data = MapToResponse(o, jumlahDesa, jumlahAdmin)
            });
        }

        // DELETE: api/Organisasi/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<string>>> Delete(int id)
        {
            if (id == 1)
                return BadRequest(new ApiResponse<string> { Success = false, Message = "Organisasi default tidak boleh dihapus" });

            var o = await _context.Organisasi.FindAsync(id);
            if (o == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "Organisasi tidak ditemukan" });

            var masihPunyaDesa = await _context.DesaWisata.AnyAsync(d => d.OrganisasiId == id);
            if (masihPunyaDesa)
                return BadRequest(new ApiResponse<string>
                {
                    Success = false,
                    Message = "Organisasi masih memiliki desa wisata. Pindahkan atau hapus desanya terlebih dahulu."
                });

            _context.Organisasi.Remove(o);
            await _context.SaveChangesAsync();

            // Audit: organisasi dihapus
            var adminDelete = CurrentAdmin.FromPrincipal(User);
            await AuditLogger.LogAsync(_context, HttpContext, adminDelete?.UserId, adminDelete?.Email ?? string.Empty, adminDelete?.Role ?? string.Empty,
                "OrgDelete", $"MENGHAPUS organisasi '{o.NamaOrganisasi}'", "Organisasi", o.Id);

            return Ok(new ApiResponse<string>
            {
                Success = true,
                Message = $"Organisasi {o.NamaOrganisasi} telah dihapus",
                Data = "OK"
            });
        }

        // ===== MANAJEMEN AKUN ADMIN =====

        // GET: api/Organisasi/users
        [HttpGet("users")]
        public async Task<ActionResult<ApiResponse<List<UserResponse>>>> GetUsers([FromQuery] int? organisasiId)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();

            var query = _context.AdminUsers.Include(u => u.Organisasi).AsQueryable();
            if (!admin.IsSuperAdmin)
                query = query.Where(u => u.OrganisasiId == admin.OrganisasiId);
            else if (organisasiId.HasValue)
                query = query.Where(u => u.OrganisasiId == organisasiId.Value);

            var list = await query.OrderBy(u => u.Id).ToListAsync();
            var response = list.Select(u => new UserResponse
            {
                Id = u.Id,
                Email = u.Email,
                NamaLengkap = u.NamaLengkap,
                Role = u.Role,
                OrganisasiId = u.OrganisasiId,
                OrganisasiNama = u.Organisasi?.NamaOrganisasi,
                Aktif = u.Aktif,
                CreatedAt = u.CreatedAt
            }).ToList();

            return Ok(new ApiResponse<List<UserResponse>>
            {
                Success = true,
                Message = "Data user berhasil diambil",
                Data = response,
                TotalData = response.Count
            });
        }

        // POST: api/Organisasi/users
        [HttpPost("users")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<UserResponse>>> CreateUser([FromBody] CreateUserRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(new ApiResponse<UserResponse> { Success = false, Message = "Data tidak valid" });

            var role = request.Role == "SuperAdmin" ? "SuperAdmin" : "Admin";
            int? orgId = role == "Admin" ? request.OrganisasiId : null;
            if (role == "Admin" && !orgId.HasValue)
                return BadRequest(new ApiResponse<UserResponse> { Success = false, Message = "Admin organisasi wajib memilih organisasi" });
            if (role == "Admin" && !await _context.Organisasi.AnyAsync(o => o.Id == orgId))
                return BadRequest(new ApiResponse<UserResponse> { Success = false, Message = "Organisasi tidak ditemukan" });

            var email = request.Email.Trim().ToLowerInvariant();
            if (await _context.AdminUsers.AnyAsync(u => u.Email.ToLower() == email))
                return BadRequest(new ApiResponse<UserResponse> { Success = false, Message = "Email sudah dipakai" });

            var user = new AdminUser
            {
                Email = email,
                PasswordHash = PasswordHasher.Hash(request.Password),
                NamaLengkap = request.NamaLengkap?.Trim() ?? string.Empty,
                Role = role,
                OrganisasiId = orgId,
                Aktif = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.AdminUsers.Add(user);
            await _context.SaveChangesAsync();

            // Audit: user dibuat
            var adminUserCreate = CurrentAdmin.FromPrincipal(User);
            await AuditLogger.LogAsync(_context, HttpContext, adminUserCreate?.UserId, adminUserCreate?.Email ?? string.Empty, adminUserCreate?.Role ?? string.Empty,
                "UserCreate", $"Membuat akun {user.Email} ({user.Role})", "AdminUser", user.Id);

            return CreatedAtAction(nameof(GetUsers), new ApiResponse<UserResponse>
            {
                Success = true,
                Message = $"User {user.Email} berhasil dibuat",
                Data = new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email,
                    NamaLengkap = user.NamaLengkap,
                    Role = user.Role,
                    OrganisasiId = user.OrganisasiId,
                    OrganisasiNama = await _context.Organisasi
                        .Where(o => o.Id == user.OrganisasiId)
                        .Select(o => o.NamaOrganisasi)
                        .FirstOrDefaultAsync(),
                    Aktif = user.Aktif,
                    CreatedAt = user.CreatedAt
                }
            });
        }

        // DELETE: api/Organisasi/users/5
        [HttpDelete("users/{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<ApiResponse<string>>> DeleteUser(int id)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null) return Unauthorized();

            if (id == admin.UserId)
                return BadRequest(new ApiResponse<string> { Success = false, Message = "Tidak bisa menghapus akun sendiri" });

            var user = await _context.AdminUsers.FindAsync(id);
            if (user == null)
                return NotFound(new ApiResponse<string> { Success = false, Message = "User tidak ditemukan" });

            _context.AdminUsers.Remove(user);
            await _context.SaveChangesAsync();

            // Audit: user dihapus
            await AuditLogger.LogAsync(_context, HttpContext, admin.UserId, admin.Email, admin.Role,
                "UserDelete", $"MENGHAPUS akun {user.Email} ({user.Role})", "AdminUser", user.Id);

            return Ok(new ApiResponse<string> { Success = true, Message = $"User {user.Email} telah dihapus", Data = "OK" });
        }
    }
}
