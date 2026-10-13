using DesaWisataApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace DesaWisataApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AiChatController : ControllerBase
    {
        private readonly AiAgentService _ai;

        public AiChatController(AiAgentService ai) => _ai = ai;

        public record ChatRequest(string Message, List<ChatTurn>? History);
        public record ChatTurn(string Role, string Content);

        /// <summary>Chat dengan WisataBot — asisten AI seputar desa wisata di platform ini.</summary>
        [HttpPost]
        [AllowAnonymous]
        [EnableRateLimiting("ai-chat")]
        public async Task<IActionResult> Post([FromBody] ChatRequest req, CancellationToken ct)
        {
            if (req is null || string.IsNullOrWhiteSpace(req.Message))
                return BadRequest(new { message = "Pesan tidak boleh kosong." });
            if (req.Message.Length > 1000)
                return BadRequest(new { message = "Pesan terlalu panjang (maks 1000 karakter)." });
            if (req.History != null && req.History.Count > 12)
                return BadRequest(new { message = "Riwayat terlalu panjang (maks 12 giliran)." });

            var history = req.History?
                .Where(t => t != null && !string.IsNullOrWhiteSpace(t.Content))
                .Select(t => (t.Role == "assistant" ? "assistant" : "user", t.Content!.Trim()))
                .ToList();

            var result = await _ai.AnswerAsync(req.Message.Trim(), history, ct);
            return Ok(new { reply = result.Reply, mode = result.Mode });
        }

        /// <summary>Status mode AI (llm/fallback) — untuk badge di widget chat.</summary>
        [HttpGet("status")]
        [AllowAnonymous]
        [EnableRateLimiting("public")]
        public IActionResult Status()
        {
            var hasKey = !string.IsNullOrWhiteSpace(HttpContext.RequestServices
                .GetRequiredService<IConfiguration>()[ "GROQ_API_KEY"]);
            return Ok(new { mode = hasKey ? "llm" : "fallback", botName = "WisataBot" });
        }
    }
}
