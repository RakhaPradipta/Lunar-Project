using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using DesaWisataApi.Models;

namespace DesaWisataApi.Services
{
public class JwtService
{
    private readonly IConfiguration _config;
    private readonly string _secret;

    // Secret di-inject dari Program.cs (satu sumber untuk signing & validation)
    public JwtService(IConfiguration config, string secret)
    {
        _config = config;
        _secret = secret;
    }

        public (string Token, DateTime ExpiresAt) CreateToken(AdminUser user, string? organisasiNama)
        {
            var issuer = _config["Jwt:Issuer"] ?? "DesaWisataApi";
            var audience = _config["Jwt:Audience"] ?? "DesaWisataFrontend";
            var expireHours = double.TryParse(_config["Jwt:ExpireHours"], out var h) ? h : 12;

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")), // id unik token untuk revocation (logout server-side)
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.NamaLengkap),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Role, user.Role),
            };
            if (user.OrganisasiId.HasValue)
            {
                claims.Add(new Claim("organisasiId", user.OrganisasiId.Value.ToString()));
            }
            if (!string.IsNullOrEmpty(organisasiNama))
            {
                claims.Add(new Claim("organisasiNama", organisasiNama));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddHours(expireHours);

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: expires,
                signingCredentials: creds
            );

            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }
}
