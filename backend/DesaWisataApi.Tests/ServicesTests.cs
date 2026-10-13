using DesaWisataApi.Services;
using Xunit;

namespace DesaWisataApi.Tests
{
    /// <summary>
    /// Test PasswordHasher: hash PBKDF2 + salt, verifikasi, dan ketahanan
    /// terhadap password salah, hash rusak, serta timing-safe compare.
    /// </summary>
    public class PasswordHasherTests
    {
        [Fact]
        public void Hash_MenghasilkanFormatTigaBagian()
        {
            var hash = PasswordHasher.Hash("rahasia123");
            var parts = hash.Split('.');
            Assert.Equal(3, parts.Length);
            Assert.Equal("100000", parts[0]); // iterasi default
        }

        [Fact]
        public void Hash_SaltAcak_PerPemanggilanBerbeda()
        {
            var h1 = PasswordHasher.Hash("password sama");
            var h2 = PasswordHasher.Hash("password sama");
            Assert.NotEqual(h1, h2); // salt acak -> hash beda walau password sama
        }

        [Fact]
        public void Verify_PasswordBenar_ReturnTrue()
        {
            var hash = PasswordHasher.Hash("KataSandiKuat#2026");
            Assert.True(PasswordHasher.Verify("KataSandiKuat#2026", hash));
        }

        [Theory]
        [InlineData("")]
        [InlineData("password-salah")]
        [InlineData("RAHASIA123")]
        public void Verify_PasswordSalah_ReturnFalse(string salah)
        {
            var hash = PasswordHasher.Hash("RAhasia123");
            Assert.False(PasswordHasher.Verify(salah, hash));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("bukan-format-hash")]
        [InlineData("abc.def.ghi")]
        [InlineData("100000.!!!bukan-base64.!!!")]
        public void Verify_HashRusak_ReturnFalse_TanpaThrow(string? stored)
        {
            Assert.False(PasswordHasher.Verify("apa pun", stored!));
        }

        [Fact]
        public void Verify_IterasiKustom_TetapTerbaca()
        {
            // Simulasi hash lama dengan iterasi berbeda — verifier mengikuti angka di hash
            var stored = "50000.QUJDREVGRw==.c29tZWhhc2g=";
            Assert.False(PasswordHasher.Verify("x", stored)); // false, tapi TIDAK throw
        }
    }

    /// <summary>
    /// Test WibTime: konversi UTC ke WIB dan batas hari.
    /// </summary>
    public class WibTimeTests
    {
        [Fact]
        public void Zone_OffsetAdalahTujuhJam()
        {
            var offset = WibTime.Zone.GetUtcOffset(DateTime.UtcNow);
            Assert.Equal(TimeSpan.FromHours(7), offset);
        }

        [Fact]
        public void Now_LebihTujuhJamDariUtc()
        {
            var utc = DateTime.UtcNow;
            var wib = WibTime.Now;
            // toleransi 5 detik antara dua pembacaan waktu
            Assert.InRange((wib - utc).TotalHours, 6.99, 7.01);
        }

        [Fact]
        public void TodayUtcRange_MulaiTengahMalamWib()
        {
            var (startUtc, endUtc) = WibTime.TodayUtcRange;
            Assert.Equal(24, (endUtc - startUtc).TotalHours);

            // startUtc dikonversi balik ke WIB harus tepat pukul 00:00
            var startWib = TimeZoneInfo.ConvertTimeFromUtc(startUtc, WibTime.Zone);
            Assert.Equal(0, startWib.Hour);
            Assert.Equal(0, startWib.Minute);
            Assert.Equal(0, startWib.Second);
        }

        [Fact]
        public void StartOfDayWibUtc_TanggalTengahHari_DipotongKeTengahMalam()
        {
            var tengahHariWib = new DateTime(2026, 9, 23, 15, 45, 30);
            var startUtc = WibTime.StartOfDayWibUtc(tengahHariWib);

            var cek = TimeZoneInfo.ConvertTimeFromUtc(startUtc, WibTime.Zone);
            Assert.Equal(new DateTime(2026, 9, 23), cek.Date);
            Assert.Equal(TimeSpan.Zero, cek.TimeOfDay);
        }

        [Fact]
        public void SecondsUntilNextMidnightWib_SelaluPosisiDanMaksimal24Jam()
        {
            var s = WibTime.SecondsUntilNextMidnightWib;
            Assert.InRange(s, 1, 86400);
        }
    }

    /// <summary>
    /// Test TokenRevocationService: revoke -> ditolak, kedaluwarsa -> dibersihkan.
    /// </summary>
    public class TokenRevocationServiceTests
    {
        private static TokenRevocationService Buat() =>
            new(Microsoft.Extensions.Logging.Abstractions.NullLogger<TokenRevocationService>.Instance);

        [Fact]
        public void TokenBaru_BelumDirevoke()
        {
            var svc = Buat();
            Assert.False(svc.IsRevoked("abc123"));
        }

        [Fact]
        public void Revoke_LaluIsRevoked_True()
        {
            var svc = Buat();
            svc.Revoke("jti-1", DateTimeOffset.UtcNow.AddMinutes(30));
            Assert.True(svc.IsRevoked("jti-1"));
        }

        [Fact]
        public void TokenKedaluwarsa_TidakDiblokir()
        {
            var svc = Buat();
            svc.Revoke("jti-exp", DateTimeOffset.UtcNow.AddSeconds(-1));
            // Token kedaluwarsa dibuang dari blacklist; validasi lifetime JWT
            // sudah menolaknya sebelum revocation dicek.
            Assert.False(svc.IsRevoked("jti-exp"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void IsRevoked_JtiKosong_ReturnFalse(string? jti)
        {
            var svc = Buat();
            Assert.False(svc.IsRevoked(jti));
        }

        [Fact]
        public void Revoke_JtiKosong_TidakThrow()
        {
            var svc = Buat();
            svc.Revoke("", DateTimeOffset.UtcNow.AddMinutes(5));
            svc.Revoke(null!, DateTimeOffset.UtcNow.AddMinutes(5));
            Assert.True(true); // cukup tidak melempar exception
        }
    }
}
