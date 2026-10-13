using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Agent AI asisten desa wisata. Semua jawaban HANYA berdasarkan data desa di database
    /// (context di-inject ke system prompt). Topik di luar platform ditolak.
    /// Mode: "llm" (Groq, jika GROQ_API_KEY diset) atau "fallback" (rule-based dari DB).
    /// Jev gate (TypeSafe AI via Cloudflare Workers AI, model typesafe/jev): klasifikasi
    /// off-topic murah & cepat SEBELUM panggilan Groq — hemat kuota LLM.
    /// </summary>
    public class AiAgentService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IHttpClientFactory _httpFactory;
        private readonly ILogger<AiAgentService> _logger;

        public AiAgentService(AppDbContext db, IConfiguration config, IHttpClientFactory httpFactory, ILogger<AiAgentService> logger)
        {
            _db = db;
            _config = config;
            _httpFactory = httpFactory;
            _logger = logger;
        }

        private string? ApiKey => _config["GROQ_API_KEY"];
        private string Model => _config["GROQ_MODEL"] ?? "openai/gpt-oss-120b";

        // ---- Jev gate (TypeSafe AI, via Cloudflare Workers AI) ----
        private string? CfAccountId => _config["CLOUDFLARE_ACCOUNT_ID"];
        private string? CfApiToken => _config["CLOUDFLARE_API_TOKEN"];
        private bool JevEnabled => !string.IsNullOrWhiteSpace(CfAccountId) && !string.IsNullOrWhiteSpace(CfApiToken);
        /// <summary>Ambang probabilitas "off-topic" untuk menolak tanpa LLM (0–1, default 0.85).</summary>
        private double JevGateThreshold =>
            double.TryParse(_config["JEV_GATE_THRESHOLD"], System.Globalization.CultureInfo.InvariantCulture, out var t) && t is > 0 and < 1 ? t : 0.85;

        public record AiChatResult(string Reply, string Mode);

        // ================= PUBLIC =================

        public async Task<AiChatResult> AnswerAsync(string message, List<(string Role, string Content)>? history, CancellationToken ct)
        {
            var desas = await _db.DesaWisata.AsNoTracking().Where(d => d.Aktif).OrderBy(d => d.Id).ToListAsync(ct);

            // Jev gate: tolak off-topic tanpa menyentuh Groq (hemat kuota).
            // Gagal/error gate = fail-open (tetap lanjut ke Groq, tidak pernah memblokir chat).
            if (JevEnabled && !string.IsNullOrWhiteSpace(message))
            {
                var (offTopic, prob) = await JevClassifyOffTopicAsync(message, ct);
                if (offTopic)
                {
                    _logger.LogInformation("Jev gate: menolak off-topic (p={Prob:F2}): {Message}", prob, Truncate(message, 80));
                    return new AiChatResult(
                        "Maaf, aku hanya bisa membantu seputar desa wisata di platform ini. 😊\n" +
                        "Coba tanya misalnya: \"Rekomendasi desa wisata alam?\" atau \"Harga tiket [nama desa]?\"",
                        "llm"); // mode 'llm' agar widget tidak menampilkan label 'Data'
                }
            }

            if (!string.IsNullOrWhiteSpace(ApiKey))
            {
                try
                {
                    return await AnswerWithLlmAsync(message, history, desas, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Groq LLM gagal, jatuh ke mode fallback");
                }
            }
            return new AiChatResult(AnswerWithRules(message, desas), "fallback");
        }

        // ================= JEV GATE (Cloudflare Workers AI: typesafe/jev) =================

        private async Task<(bool OffTopic, double Probability)> JevClassifyOffTopicAsync(string message, CancellationToken ct)
        {
            try
            {
                var http = _httpFactory.CreateClient("jev");
                http.Timeout = TimeSpan.FromSeconds(8); // gate harus cepat; gagal = fail-open
                http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", CfApiToken);

                var payload = new
                {
                    state = Truncate(message, 500),
                    questions = new
                    {
                        off_topic = new
                        {
                            type = "choice",
                            instructions = "Classify the user message topic. The platform is an Indonesian village-tourism information & booking site. 'on_topic' = asks about villages, ticket prices, taxes, parking, opening hours, visitor capacity, facilities, manager contact, recommendations, or how to book.",
                            criteria = new
                            {
                                on_topic = "Tourism questions about the villages on this platform",
                                off_topic = "Anything else: coding, politics, news, recipes, homework, general chat, abuse, gibberish",
                            },
                        },
                    },
                };

                using var resp = await http.PostAsJsonAsync(
                    $"https://api.cloudflare.com/client/v4/accounts/{CfAccountId}/ai/run/typesafe/jev", payload, ct);
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Jev gate HTTP {Status} — fail-open ke Groq", (int)resp.StatusCode);
                    return (false, 0);
                }

                using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                // Bentuk respons Workers AI: { success, result: { answers: { off_topic: { choice, probabilities } } }, errors }
                if (!root.TryGetProperty("result", out var result) ||
                    !result.TryGetProperty("answers", out var answers) ||
                    !answers.TryGetProperty("off_topic", out var answer) ||
                    !answer.TryGetProperty("probabilities", out var probs))
                {
                    _logger.LogWarning("Jev gate: format respons tak dikenal — fail-open ke Groq");
                    return (false, 0);
                }

                double pOff = probs.TryGetProperty("off_topic", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetDouble() : 0;
                return (pOff >= JevGateThreshold, pOff);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Jev gate gagal — fail-open ke Groq");
                return (false, 0);
            }
        }

        // ================= CONTEXT BUILDER =================
        // Hemat token (free tier Groq = 8000 TPM): ringkas 1 baris untuk semua desa,
        // detail lengkap hanya untuk desa yang disebut di pertanyaan/riwayat.

        private static string BuildContext(List<DesaWisata> desas, string message, List<(string Role, string Content)>? history)
        {
            var sb = new StringBuilder();
            sb.AppendLine("## Daftar desa (id | nama | lokasi | kategori | rating | total tiket lokal | status hari ini):");
            foreach (var d in desas)
            {
                var total = Math.Round(d.HargaTiketLokal * (1 + d.PersenPajakDaerah / 100.0));
                var pct = d.BatasPengunjung > 0 ? (int)Math.Round(100.0 * d.PengunjungHariIni / d.BatasPengunjung) : 0;
                sb.AppendLine($"[{d.Id}] {d.NamaDesa} | {d.Lokasi} | {d.Kategori} | ⭐{d.Rating}/5 | Rp{total:N0} | {d.PengunjungHariIni}/{d.BatasPengunjung} ({pct}%)");
            }

            // Detail penuh untuk desa yang relevan dengan pertanyaan
            var haystack = (message + " " + string.Join(" ", history?.Select(h => h.Content) ?? Array.Empty<string>())).ToLowerInvariant();
            var mentioned = desas.Where(d => NameMatches(d, haystack)).Take(5).ToList();
            if (mentioned.Count > 0)
            {
                sb.AppendLine("\n## Detail desa yang ditanyakan:");
                foreach (var d in mentioned)
                {
                    var total = Math.Round(d.HargaTiketLokal * (1 + d.PersenPajakDaerah / 100.0));
                    var pct = d.BatasPengunjung > 0 ? (int)Math.Round(100.0 * d.PengunjungHariIni / d.BatasPengunjung) : 0;
                    sb.AppendLine($"[{d.Id}] {d.NamaDesa} — {d.Lokasi}");
                    sb.AppendLine($"  Deskripsi: {Truncate(d.Deskripsi, 160)}");
                    sb.AppendLine($"  Status: {d.StatusOperasional}, jam {d.JamBuka}-{d.JamTutup} WIB, hari {d.HariOperasional}");
                    sb.AppendLine($"  Harga: lokal Rp{d.HargaTiketLokal:N0} + pajak {d.PersenPajakDaerah:0.##}% = Rp{total:N0}; mancanegara Rp{d.HargaTiketMancanegara:N0}; parkir motor Rp{d.HargaParkirMotor:N0}, mobil Rp{d.HargaParkirMobil:N0} (bebas pajak)");
                    sb.AppendLine($"  Pengunjung hari ini: {d.PengunjungHariIni}/{d.BatasPengunjung} ({pct}%)");
                    sb.AppendLine($"  Fasilitas: {Truncate(d.Fasilitas, 120)}");
                    var kontak = new[] { d.KontakPengelola, d.EmailPengelola, d.SocialMedia }.Where(s => !string.IsNullOrWhiteSpace(s));
                    if (kontak.Any()) sb.AppendLine($"  Kontak: {string.Join(" | ", kontak)}");
                }
            }
            return sb.ToString();
        }

        private static bool NameMatches(DesaWisata d, string haystack)
        {
            var nama = d.NamaDesa.ToLowerInvariant();
            if (haystack.Contains(nama)) return true;
            // cocokkan kata penting nama desa (mis. "sade", "penglipuran", "wae rebo")
            var words = nama.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3 && !new[] { "desa", "wisata" }.Contains(w));
            return words.Any(haystack.Contains);
        }

        private static string Truncate(string s, int max) => string.IsNullOrEmpty(s) ? "-" : (s.Length <= max ? s : s[..max] + "…");

        private static string SystemPrompt(List<DesaWisata> desas, string message, List<(string Role, string Content)>? history)
        {
            return """
                Kamu adalah "WisataBot", asisten virtual resmi platform DesaWisata Nusantara (web informasi & booking desa wisata Indonesia).

                ATURAN KETAT:
                1. HANYA jawab berdasarkan DATA DESA di bawah ini. Jangan mengarang data yang tidak ada di context.
                2. Topik yang BOLEH: daftar desa, lokasi, harga tiket & pajak & parkir, jam & hari operasional, kapasitas/keramaian hari ini, fasilitas, kontak pengelola, kategori/rating, rekomendasi desa yang cocok, cara booking di platform ini.
                3. Topik DI LUAR itu (coding, politik, berita umum, resep, matematika, dll) → tolak singkat & sopan (1-2 kalimat), arahkan kembali ke desa wisata. Contoh: "Maaf, aku hanya bisa membantu seputar desa wisata di platform ini. 😊"
                4. Jika data yang diminta tidak tersedia (misal cuaca detail atau harga homestay), katakan tidak tersedia dan sarankan menghubungi kontak pengelola desa.
                5. Jawab dalam Bahasa Indonesia yang ramah, ringkas (maks ~120 kata), gunakan poin/bullet bila membandingkan beberapa desa.
                6. Bila relevan, sebutkan nama desa secara eksplisit. Format harga: "Rp10.000".
                7. Jika user tertarik mengunjungi / bertanya cara berkunjung, ajak booking dengan link [Booking {nama desa}](/desa/{id}?booking=1) persis format itu (id dari data). Contoh: "Yuk booking dulu [Booking Desa Wisata Sasak Sade Lombok](/desa/22?booking=1)".
                8. JANGAN mengarang proses/cara yang tidak ada di platform (mis. metode pembayaran, e-ticket, langkah offline). Cara booking: pilih desa → klik tombol booking → isi form kunjungan. Cukup itu.
                """ + "\n" + BuildContext(desas, message, history);
        }

        // ================= LLM (GROQ) =================

        private async Task<AiChatResult> AnswerWithLlmAsync(string message, List<(string Role, string Content)>? history, List<DesaWisata> desas, CancellationToken ct)
        {
            var http = _httpFactory.CreateClient("groq");
            http.Timeout = TimeSpan.FromSeconds(45);
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", ApiKey);

            var messages = new List<object> { new { role = "system", content = SystemPrompt(desas, message, history) } };
            if (history != null)
            {
                foreach (var (role, content) in history.TakeLast(8))
                    messages.Add(new { role = role == "assistant" ? "assistant" : "user", content = Truncate(content, 1500) });
            }
            messages.Add(new { role = "user", content = Truncate(message, 1000) });

            var payload = new
            {
                model = Model,
                messages,
                temperature = 0.4,
                max_tokens = 600,
            };

            // Max 2 retry saat kena rate limit 429 (jendela reset Groq biasanya beberapa detik)
            HttpResponseMessage resp = null!;
            for (int attempt = 0; ; attempt++)
            {
                resp = await http.PostAsJsonAsync("https://api.groq.com/openai/v1/chat/completions", payload, ct);
                if (resp.IsSuccessStatusCode) break;
                if (resp.StatusCode == System.Net.HttpStatusCode.TooManyRequests && attempt < 2)
                {
                    resp.Dispose();
                    await Task.Delay(TimeSpan.FromSeconds(6), ct);
                    continue;
                }
                resp.EnsureSuccessStatusCode(); // throw untuk fallback
            }

            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            var reply = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            if (string.IsNullOrWhiteSpace(reply)) throw new InvalidOperationException("Empty LLM reply");
            return new AiChatResult(reply.Trim(), "llm");
        }

        // ================= RULE-BASED FALLBACK =================

        private static string AnswerWithRules(string message, List<DesaWisata> desas)
        {
            var q = (message ?? "").ToLowerInvariant();
            if (desas.Count == 0) return "Belum ada desa wisata terdaftar di platform. Silakan cek kembali nanti. 😊";

            // Cari desa yang disebut nama di pesan
            var mentioned = desas
                .Where(d => q.Contains(d.NamaDesa.ToLowerInvariant()) ||
                            (d.NamaDesa.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length > 1 &&
                             d.NamaDesa.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).Any(w => w.Length > 4 && q.Contains(w))))
                .ToList();
            var target = mentioned.Count == 1 ? mentioned[0] : null;

            bool wantsHarga = ContainsAny(q, "harga", "tiket", "biaya", "pajak", "parkir", " tarif", "berapa");
            bool wantsJam = ContainsAny(q, "jam", "buka", "tutup", "operasional");
            bool wantsRamai = ContainsAny(q, "ramai", "sepi", "kapasitas", "penuh", "pengunjung", "wisatawan", "lengang", "crowd");
            bool wantsFasilitas = ContainsAny(q, "fasilitas", "toilet", "parkir", "wifi", "homestay", "musholla", "penginapan");
            bool wantsKontak = ContainsAny(q, "kontak", "hubungi", "whatsapp", "wa ", "telepon", "email", "alamat", "lokasi", "dimana", "di mana");
            bool wantsRekomendasi = ContainsAny(q, "rekomendasi", "rekomendasikan", "best", "terbaik", "bagus", "mau liburan", "wisata apa");
            bool wantsDaftar = ContainsAny(q, "desa apa", "daftar desa", "ada apa", "semua desa", "destinasi");

            if (target != null && (wantsHarga || wantsJam || wantsRamai || wantsFasilitas || wantsKontak || q.Length < 60))
                return DescribeDesa(target, wantsHarga, wantsJam, wantsRamai, wantsFasilitas, wantsKontak);

            if (wantsRekomendasi || wantsDaftar)
                return ListDesa(desas, wantsRekomendasi ? q : null);

            if (wantsHarga && target == null) return HargaSemua(desas);
            if (wantsRamai && target == null) return KapasitasSemua(desas);

            return """
                Halo! Aku 🤖 WisataBot, asisten DesaWisata Nusantara. Aku bisa bantu menjawab seputar:
                • Daftar desa wisata & rekomendasi
                • Harga tiket, pajak daerah & parkir
                • Jam operasional & status buka/tutup
                • Kepadatan pengunjung hari ini
                • Fasilitas & kontak pengelola
                Coba tanya, misalnya: "Rekomendasi desa wisata alam?" atau "Harga tiket Sasak Sade?"
                """;
        }

        private static bool ContainsAny(string q, params string[] words) => words.Any(q.Contains);

        private static string Rupiah(int n) => $"Rp{n:N0}".Replace(",", ".");

        private static string DescribeDesa(DesaWisata d, bool harga, bool jam, bool ramai, bool fasilitas, bool kontak)
        {
            var total = Math.Round(d.HargaTiketLokal * (1 + d.PersenPajakDaerah / 100.0));
            var pct = d.BatasPengunjung > 0 ? (int)Math.Round(100.0 * d.PengunjungHariIni / d.BatasPengunjung) : 0;
            var status = pct >= d.ThresholdPeringatan ? "🟠 Ramai" : pct >= 50 ? "🟢 Sedang" : "🔵 Lengang";
            var sb = new StringBuilder();
            sb.AppendLine($"**{d.NamaDesa}** ({d.Kategori}, ⭐{d.Rating}/5) — {d.Lokasi}");
            if (!string.IsNullOrWhiteSpace(d.Deskripsi)) sb.AppendLine(Truncate(d.Deskripsi, 200));
            if (harga || !jam && !ramai && !fasilitas && !kontak)
            {
                sb.AppendLine($"🎫 Tiket lokal {Rupiah(d.HargaTiketLokal)} + pajak daerah {d.PersenPajakDaerah:0.##}% = **{Rupiah((int)total)}**");
                sb.AppendLine($"🌏 Tiket mancanegara {Rupiah(d.HargaTiketMancanegara)} | 🅿️ Parkir motor {Rupiah(d.HargaParkirMotor)}, mobil {Rupiah(d.HargaParkirMobil)}");
            }
            if (jam || !harga && !ramai && !fasilitas && !kontak)
                sb.AppendLine($"🕐 {d.StatusOperasional}, {d.JamBuka}-{d.JamTutup} WIB ({d.HariOperasional})");
            if (ramai || !harga && !jam && !fasilitas && !kontak)
                sb.AppendLine($"👥 Hari ini: {d.PengunjungHariIni}/{d.BatasPengunjung} pengunjung ({pct}%) — {status}");
            if (fasilitas || !harga && !jam && !ramai && !kontak)
                sb.AppendLine($"🏕️ Fasilitas: {d.Fasilitas}");
            if (kontak || !harga && !jam && !ramai && !fasilitas)
            {
                var c = new[] { d.KontakPengelola, d.EmailPengelola, d.SocialMedia }.Where(s => !string.IsNullOrWhiteSpace(s));
                sb.AppendLine(c.Any() ? $"📞 Kontak: {string.Join(" | ", c)}" : "📞 Kontak pengelola belum tersedia.");
            }
            if (d.StatusOperasional == "Buka")
                sb.AppendLine($"🎟️ Mau berkunjung? Yuk booking dulu: [Booking {d.NamaDesa}](/desa/{d.Id}?booking=1)");
            return sb.ToString().TrimEnd();
        }

        private static string HargaSemua(List<DesaWisata> desas)
        {
            var lines = desas.Take(10).Select(d =>
            {
                var total = Math.Round(d.HargaTiketLokal * (1 + d.PersenPajakDaerah / 100.0));
                return $"• **{d.NamaDesa}**: {Rupiah(d.HargaTiketLokal)} + pajak {d.PersenPajakDaerah:0.##}% = {Rupiah((int)total)}";
            });
            return "🎫 Harga tiket lokal per desa (sudah termasuk pajak daerah):\n" + string.Join("\n", lines) +
                   (desas.Count > 10 ? $"\n…dan {desas.Count - 10} desa lainnya. Sebutkan nama desa untuk detail." : "");
        }

        private static string KapasitasSemua(List<DesaWisata> desas)
        {
            var ranked = desas
                .Where(d => d.BatasPengunjung > 0)
                .OrderByDescending(d => (double)d.PengunjungHariIni / d.BatasPengunjung)
                .Take(8);
            var lines = ranked.Select(d =>
            {
                var pct = (int)Math.Round(100.0 * d.PengunjungHariIni / d.BatasPengunjung);
                var emoji = pct >= d.ThresholdPeringatan ? "🟠 Ramai" : pct >= 50 ? "🟢 Sedang" : "🔵 Lengang";
                return $"• **{d.NamaDesa}**: {d.PengunjungHariIni}/{d.BatasPengunjung} ({pct}%) {emoji}";
            });
            return "👥 Kepadatan pengunjung hari ini (terramai dulu):\n" + string.Join("\n", lines);
        }

        private static string ListDesa(List<DesaWisata> desas, string? q)
        {
            IEnumerable<DesaWisata> list = desas;
            var kategori = q == null ? null : new[] { "alam", "budaya", "pantai", "gunung", "agrowisata" }.FirstOrDefault(q.Contains);
            if (kategori != null) list = desas.Where(d => d.Kategori.ToLowerInvariant().Contains(kategori));
            var top = list.OrderByDescending(d => d.Rating).ThenByDescending(d => d.JumlahWisatawan).Take(6).ToList();
            if (top.Count == 0) return $"Belum ada desa kategori \"{kategori}\" di platform. Kategori tersedia: {string.Join(", ", desas.Select(d => d.Kategori).Distinct())}.";
            var lines = top.Select(d => $"• ⭐{d.Rating}/5 **{d.NamaDesa}** ({d.Kategori}) — {d.Lokasi} → [Booking](/desa/{d.Id}?booking=1)");
            return (kategori != null ? $"Rekomendasi desa kategori \"{kategori}\":\n" : "Desa wisata di platform kami:\n") + string.Join("\n", lines) +
                   "\nTanya detail desa tertentu untuk harga, jam buka & kepadatan hari ini! 😊";
        }
    }
}
