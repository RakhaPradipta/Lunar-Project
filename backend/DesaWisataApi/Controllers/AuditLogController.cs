using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DesaWisataApi.Data;
using DesaWisataApi.DTOs;
using DesaWisataApi.Services;

namespace DesaWisataApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AuditLogController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditLogController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AuditLog?aksi=DesaDelete&email=admin&limit=100
        // Hanya SuperAdmin boleh membaca jejak audit.
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<AuditLogResponse>>>> GetAll(
            [FromQuery] string? aksi,
            [FromQuery] string? entitas,
            [FromQuery] string? email,
            [FromQuery] int limit = 100)
        {
            var admin = CurrentAdmin.FromPrincipal(User);
            if (admin == null)
                return Unauthorized(new ApiResponse<List<AuditLogResponse>> { Success = false, Message = "Token tidak valid" });
            if (admin.Role != "SuperAdmin")
                return StatusCode(403, new ApiResponse<List<AuditLogResponse>> { Success = false, Message = "Hanya SuperAdmin dapat melihat audit log" });

            var safeLimit = Math.Clamp(limit, 1, 500);

            var query = _context.AuditLogs.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(aksi))
                query = query.Where(l => l.Aksi == aksi.Trim());
            if (!string.IsNullOrWhiteSpace(entitas))
                query = query.Where(l => l.Entitas == entitas.Trim());
            if (!string.IsNullOrWhiteSpace(email))
                query = query.Where(l => l.Email.ToLower().Contains(email.Trim().ToLower()));

            var logs = await query
                .OrderByDescending(l => l.CreatedAt)
                .ThenByDescending(l => l.Id)
                .Take(safeLimit)
                .Select(l => new AuditLogResponse
                {
                    Id = l.Id,
                    CreatedAt = l.CreatedAt,
                    UserId = l.UserId,
                    Email = l.Email,
                    Role = l.Role,
                    Aksi = l.Aksi,
                    Keterangan = l.Keterangan,
                    Entitas = l.Entitas,
                    EntitasId = l.EntitasId,
                    IpAddress = l.IpAddress
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<AuditLogResponse>>
            {
                Success = true,
                Message = "Audit log berhasil diambil",
                Data = logs,
                TotalData = logs.Count
            });
        }
    }
}
