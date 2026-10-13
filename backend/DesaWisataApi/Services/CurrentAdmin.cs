using System.Security.Claims;
using DesaWisataApi.Models;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Info admin yang sedang login, diambil dari klaim JWT.
    /// Dipakai untuk scoping data per tenant (organisasi).
    /// </summary>
    public class CurrentAdmin
    {
        public int UserId { get; init; }
        public string Email { get; init; } = string.Empty;
        public string NamaLengkap { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
        public int? OrganisasiId { get; init; }

        public bool IsSuperAdmin => Role == "SuperAdmin";

        /// <summary>Ambil admin dari HttpContext, atau null jika belum login.</summary>
        public static CurrentAdmin? FromPrincipal(ClaimsPrincipal user)
        {
            if (user.Identity?.IsAuthenticated != true) return null;

            var idStr = user.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user.FindFirstValue(JwtRegisteredClaimNamesConst.Sub);
            if (!int.TryParse(idStr, out var id)) return null;

            var orgStr = user.FindFirstValue("organisasiId");

            return new CurrentAdmin
            {
                UserId = id,
                Email = user.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
                NamaLengkap = user.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
                Role = user.FindFirstValue(ClaimTypes.Role) ?? string.Empty,
                OrganisasiId = int.TryParse(orgStr, out var orgId) ? orgId : null,
            };
        }
    }

    internal static class JwtRegisteredClaimNamesConst
    {
        internal const string Sub = "sub";
    }
}
