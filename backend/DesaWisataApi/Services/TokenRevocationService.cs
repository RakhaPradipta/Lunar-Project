using System.Collections.Concurrent;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Blacklist jti (JWT ID) token yang di-revoke lewat logout server-side.
    ///
    /// In-memory: cocok untuk skala ini (single instance + SQLite) dan tanpa
    /// dependensi tambahan. Token tetap lolos validasi tanda tangan, tapi
    /// OnTokenValidated di Program.cs menolak token yang jti-nya ada di sini.
    /// Entri dibersihkan otomatis setelah token kedaluwarsa sehingga memori
    /// tidak tumbuh tanpa batas.
    ///
    /// Catatan scale-out: bila nanti menjalankan lebih dari satu instance,
    /// ganti penyimpanan ini ke database/Redis agar blacklist dibagi antar node.
    /// </summary>
    public class TokenRevocationService
    {
        private readonly ConcurrentDictionary<string, DateTimeOffset> _revoked = new();
        private readonly ILogger<TokenRevocationService> _logger;

        public TokenRevocationService(ILogger<TokenRevocationService> logger)
        {
            _logger = logger;
        }

        /// <summary>Revoke sebuah jti sampai waktu kedaluwarsa token-nya.</summary>
        public void Revoke(string jti, DateTimeOffset expiresAt)
        {
            if (string.IsNullOrWhiteSpace(jti)) return;
            _revoked[jti] = expiresAt;
            Cleanup();
        }

        /// <summary>Apakah token dengan jti ini sudah direvoke? Entri kedaluwarsa ikut dibuang.</summary>
        public bool IsRevoked(string? jti)
        {
            if (string.IsNullOrWhiteSpace(jti)) return false;
            // Entri kedaluwarsa tidak diblokir (validasi lifetime JWT sudah menolaknya)
            // dan langsung dibuang agar memori bersih tanpa menunggu threshold cleanup.
            if (_revoked.TryGetValue(jti, out var exp) && exp <= DateTimeOffset.UtcNow)
            {
                _revoked.TryRemove(jti, out _);
                return false;
            }
            return _revoked.ContainsKey(jti);
        }

        /// <summary>Buang entri yang token-nya sudah kedaluwarsa (tidak bisa dipakai lagi siapa pun).</summary>
        private void Cleanup()
        {
            if (_revoked.Count < 128) return; // hemat kerja pada beban kecil
            var now = DateTimeOffset.UtcNow;
            foreach (var (jti, exp) in _revoked)
            {
                if (exp <= now)
                {
                    _revoked.TryRemove(jti, out _);
                }
            }
        }
    }
}
