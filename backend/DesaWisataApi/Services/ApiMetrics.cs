using System.Collections.Concurrent;
using DesaWisataApi.Data;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Agregator metrik pemakaian API klien (website eksternal).
    ///
    /// Dulu setiap request API klien melakukan UPDATE LastUsedAt/JumlahRequest langsung
    /// ke SQLite — hot path write yang tidak perlu dan bisa mengunci DB.
    /// Sekarang hitungan ditumpuk di memori dan di-flush periodik (60 detik) ke DB
    /// oleh MetricsFlushService. Data yang tampil di dashboard SuperAdmin tetap akurat
    /// (presisi menit), beban DB turun drastis.
    /// </summary>
    public static class ApiMetrics
    {
        private sealed class Counter
        {
            public long Count;
            public DateTime LastUsedUtc;
        }

        private static readonly ConcurrentDictionary<int, Counter> Pending = new();

        /// <summary>Catat satu request dari klien tsb (dipanggil di jalur request, tanpa I/O).</summary>
        public static void Track(int clientId)
        {
            var c = Pending.GetOrAdd(clientId, _ => new Counter());
            Interlocked.Increment(ref c.Count);
            c.LastUsedUtc = DateTime.UtcNow;
        }

        /// <summary>
        /// Ambil & kosongkan antrian (dipanggil oleh flush service).
        /// Return: clientId -> (jumlah request sejak flush terakhir, LastUsedAt).
        /// </summary>
        public static Dictionary<int, (long Count, DateTime LastUsedUtc)> Drain()
        {
            var result = new Dictionary<int, (long, DateTime)>();
            foreach (var id in Pending.Keys)
            {
                if (Pending.TryRemove(id, out var c) && Volatile.Read(ref c.Count) > 0)
                {
                    result[id] = (Volatile.Read(ref c.Count), c.LastUsedUtc);
                }
            }
            return result;
        }
    }

    /// <summary>Flush metrik API ke database tiap 60 detik (best-effort).</summary>
    public class MetricsFlushService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<MetricsFlushService> _logger;

        public MetricsFlushService(IServiceScopeFactory scopeFactory, ILogger<MetricsFlushService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }

                try
                {
                    await FlushAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[ApiMetrics] Gagal flush metrik (dicoba lagi di siklus berikutnya).");
                }
            }
        }

        public async Task FlushAsync(CancellationToken ct = default)
        {
            var batch = ApiMetrics.Drain();
            if (batch.Count == 0) return;

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            foreach (var (clientId, (count, lastUsed)) in batch)
            {
                await db.ApiClients
                    .Where(c => c.Id == clientId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.JumlahRequest, c => c.JumlahRequest + (int)count)
                        .SetProperty(c => c.LastUsedAt, lastUsed), ct);
            }
            _logger.LogDebug("[ApiMetrics] Flushed {Jumlah} klien metrik ke DB.", batch.Count);
        }
    }
}
