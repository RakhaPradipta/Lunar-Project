namespace DesaWisataApi.Services
{
    /// <summary>
    /// Zona waktu WIB (UTC+7) — dipakai untuk semua perhitungan "hari ini" yang
    /// berorientasi pengguna Indonesia (nomor karcis harian, nomor booking harian,
    /// reset otomatis PengunjungHariIni).
    ///
    /// Sebelumnya perhitungan memakai DateTime.UtcNow.Date, sehingga antara pukul
    /// 17:00–24:00 WIB tanggal UTC sudah bergeser ke hari berikutnya — nomor karcis
    /// "harian" ikut reset terlalu pagi dan statistik harian melenceng.
    /// </summary>
    public static class WibTime
    {
        public static readonly TimeZoneInfo Zone = CreateWibZone();

        private static TimeZoneInfo CreateWibZone()
        {
            try
            {
                // Windows: id zona "SE Asia Standard Time"
                return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            }
            catch (TimeZoneNotFoundException)
            {
                // Linux/macOS: IANA id
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("Asia/Jakarta");
                }
                catch (TimeZoneNotFoundException)
                {
                    // Fallback terakhir: offset tetap +7 tanpa DST (WIB memang bebas DST)
                    return TimeZoneInfo.CreateCustomTimeZone("WIB", TimeSpan.FromHours(7), "WIB", "WIB");
                }
            }
            catch (InvalidTimeZoneException)
            {
                return TimeZoneInfo.CreateCustomTimeZone("WIB", TimeSpan.FromHours(7), "WIB", "WIB");
            }
        }

        /// <summary>Waktu sekarang dalam WIB.</summary>
        public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zone);

        /// <summary>Tanggal (tengah malam) hari ini di WIB.</summary>
        public static DateTime Today => Now.Date;

        /// <summary>
        /// Batas hari WIB ini dalam UTC: [awal hari WIB, awal hari WIB + 1).
        /// Dipakai untuk query DB yang menyimpan waktu UTC.
        /// </summary>
        public static (DateTime StartUtc, DateTime EndUtc) TodayUtcRange =>
            (StartOfTodayWibUtc, StartOfTodayWibUtc.AddDays(1));

        /// <summary>Awal hari WIB hari ini, dikonversi kembali ke UTC.</summary>
        public static DateTime StartOfTodayWibUtc =>
            TimeZoneInfo.ConvertTimeToUtc(Today, Zone);

        /// <summary>Awal hari WIB untuk tanggal kunjungan tertentu (tanggal diperlakukan sebagai tanggal WIB).</summary>
        public static DateTime StartOfDayWibUtc(DateTime tanggalWib) =>
            TimeZoneInfo.ConvertTimeToUtc(tanggalWib.Date, Zone);

        /// <summary>
        /// Berapa detik lagi sampai tengah malam WIB berikutnya (untuk timer reset harian).
        /// Minimal 1 detik agar tidak loop tanpa jeda.
        /// </summary>
        public static double SecondsUntilNextMidnightWib
        {
            get
            {
                var nowWib = Now;
                var nextMidnight = nowWib.Date.AddDays(1);
                var delta = nextMidnight - nowWib;
                return Math.Max(1, delta.TotalSeconds);
            }
        }
    }
}
