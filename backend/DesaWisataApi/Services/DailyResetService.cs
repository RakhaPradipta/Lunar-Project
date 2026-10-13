using DesaWisataApi.Data;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Background service yang mereset PengunjungHariIni = 0 untuk semua desa
    /// tepat pada pergantian hari WIB (tengah malam), lalu menghitung ulang
    /// status Overtourism. Timer dihitung ulang tiap siklus sehingga selalu
    /// akurat walaupun server tidur/lama idle.
    ///
    /// Sebelumnya tidak ada reset otomatis — angka "pengunjung hari ini" hanya
    /// bisa direset manual lewat endpoint, sehingga besoknya statistik & status
    /// overtourism jadi basi dan booking check-in bisa salah ditolak
    /// (AutoLockOvertourism melihat angka kemarin).
    /// </summary>
    public class DailyResetService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<DailyResetService> _logger;

        public DailyResetService(IServiceScopeFactory scopeFactory, ILogger<DailyResetService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("[DailyReset] Service aktif — reset PengunjungHariIni setiap tengah malam WIB.");

            while (!stoppingToken.IsCancellationRequested)
            {
                var delay = TimeSpan.FromSeconds(WibTime.SecondsUntilNextMidnightWib);
                _logger.LogInformation("[DailyReset] Reset berikutnya dalam {Jam:0.0} jam (tengah malam WIB).", delay.TotalHours);

                try
                {
                    await Task.Delay(delay, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break; // shutdown — bukan error
                }

                try
                {
                    await ResetAllAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[DailyReset] Gagal reset harian — dicoba ulang dalam 60 detik.");
                    try { await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken); }
                    catch (OperationCanceledException) { break; }
                }
            }
        }

        /// <summary>
        /// Reset PengunjungHariIni semua desa + tutup karcis yang masih aktif
        /// (CheckOutAt masih null) agar daftar wisatawan di dalam tidak bocor
        /// ke hari berikutnya.
        /// </summary>
        public async Task<int> ResetAllAsync(CancellationToken ct = default)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var nowUtc = DateTime.UtcNow;

            // Tutup semua karcis aktif (wisatawan yang belum check-out dianggap pulang)
            var affectedKarcis = await db.Pengunjung
                .Where(p => p.CheckOutAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.CheckOutAt, nowUtc), ct);

            // Reset counter harian + status overtourism
            var affectedDesa = await db.DesaWisata
                .Where(d => d.PengunjungHariIni != 0 || d.Overtourism)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(d => d.PengunjungHariIni, 0)
                    .SetProperty(d => d.Overtourism, false)
                    .SetProperty(d => d.UpdatedAt, nowUtc), ct);

            _logger.LogInformation(
                "[DailyReset] Reset harian WIB selesai: {Desa} desa direset, {Karcis} karcis aktif ditutup.",
                affectedDesa, affectedKarcis);
            return affectedDesa;
        }
    }
}
