using Microsoft.EntityFrameworkCore;
using DesaWisataApi.Data;
using DesaWisataApi.Models;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Seed data tenant (organisasi & akun admin) secara runtime dan idempoten.
    /// Tidak memakai HasData karena validasi seed EF Core 10 mensyaratkan semua
    /// properti di-set eksplisit di seed entity, dan hash password harus dibuat runtime.
    /// </summary>
    public static class DbSeeder
    {
        /// <summary>
        /// Environment variable berisi password awal SuperAdmin.
        /// WAJIB di-set di production: SEED_ADMIN_PASSWORD="..."
        /// Jika tidak diset (hanya untuk development lokal), password acak dibuat,
        /// ditampilkan SEKALI di console, dan TIDAK bisa ditebak dari luar.
        /// </summary>
        private static readonly string SeedAdminPasswordEnv = "SEED_ADMIN_PASSWORD";

        public static void Seed(AppDbContext context)
        {
            // 1) Organisasi default (Id=1) pemilik seluruh desa seed
            if (!context.Organisasi.Any(o => o.Id == 1))
            {
                context.Organisasi.Add(new Organisasi
                {
                    Id = 1,
                    NamaOrganisasi = "Organisasi Pusat DesaWisata",
                    Deskripsi = "Organisasi default pemilik seluruh desa wisata seed.",
                    Kontak = "-",
                    Email = "pusat@desawisata.go.id",
                    Aktif = true,
                    CreatedAt = DateTime.UtcNow,
                });
                context.SaveChanges();
            }

            // ===== KEAMANAN: password akun seed TIDAK boleh hardcoded lagi =====
            // Dulu "super123"/"admin123" dipublikasikan di kode — siapa pun yang membaca
            // repo bisa login sebagai SuperAdmin. Sekarang:
            //   - Production  : wajib set env SEED_ADMIN_PASSWORD, jika tidak -> startup gagal.
            //   - Development : password acak dibuat & ditampilkan SEKALI di console.
            // Akun yang SUDAH ADA di database TIDAK diubah oleh seeder.
            var seedPassword = Environment.GetEnvironmentVariable(SeedAdminPasswordEnv);

            if (string.IsNullOrWhiteSpace(seedPassword))
            {
                if (!IsDevelopmentLike(context))
                {
                    throw new InvalidOperationException(
                        "[SECURITY] Set environment variable SEED_ADMIN_PASSWORD sebelum menjalankan di production. " +
                        "Contoh: SEED_ADMIN_PASSWORD='KataSandiKuatAnda123!'");
                }

                seedPassword = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(18));
                Console.WriteLine();
                Console.WriteLine("============================================================");
                Console.WriteLine("[SECURITY] Password awal akun seed (TAMPIL SEKALI INI SAJA):");
                Console.WriteLine($"  Email    : superadmin@desawisata.go.id");
                Console.WriteLine($"  Password : {seedPassword}");
                Console.WriteLine("Segera ganti via menu Ganti Password setelah login.");
                Console.WriteLine("============================================================");
                Console.WriteLine();
            }

            // 2) SuperAdmin
            if (!context.AdminUsers.Any(u => u.Email == "superadmin@desawisata.go.id"))
            {
                context.AdminUsers.Add(new AdminUser
                {
                    Email = "superadmin@desawisata.go.id",
                    PasswordHash = PasswordHasher.Hash(seedPassword),
                    NamaLengkap = "Super Admin",
                    Role = "SuperAdmin",
                    OrganisasiId = null,
                    Aktif = true,
                    CreatedAt = DateTime.UtcNow,
                });
            }

            // 3) Admin organisasi pusat — hanya dibuat di development, pakai password seed yang sama
            if (IsDevelopmentLike(context) && !context.AdminUsers.Any(u => u.Email == "admin@desawisata.go.id"))
            {
                context.AdminUsers.Add(new AdminUser
                {
                    Email = "admin@desawisata.go.id",
                    PasswordHash = PasswordHasher.Hash(seedPassword),
                    NamaLengkap = "Admin Organisasi Pusat",
                    Role = "Admin",
                    OrganisasiId = 1,
                    Aktif = true,
                    CreatedAt = DateTime.UtcNow,
                });
            }

            context.SaveChanges();

            // ===== KEAMANAN: rotasi akun lama yang masih memakai password default publik =====
            // Database yang dibuat sebelum perbaikan ini masih punya akun super123/admin123.
            // Passwordnya diacak sekarang sehingga kredensial yang bocor menjadi tidak berguna.
            // Pemilik akun memakai fitur "Lupa/Reset" atau dibuatkan akun baru oleh admin.
            RotateLegacyDefaultPasswordAccounts(context, seedPassword);

            // 4) Pastikan semua desa seed punya pemilik (organisasi Id=1)
            context.Database.ExecuteSqlRaw(
                "UPDATE \"DesaWisata\" SET \"OrganisasiId\" = 1 WHERE \"OrganisasiId\" IS NULL OR \"OrganisasiId\" = 0");
        }

        /// <summary>
        /// Deteksi kasar environment development (aspnetcore env atau env var ASPNETCORE_ENVIRONMENT).
        /// </summary>
        private static bool IsDevelopmentLike(AppDbContext context)
        {
            var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                      ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
                      ?? "Production";
            return env.Equals("Development", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Akun seed bawaan yang passwordnya masih default publik (super123/admin123)
        /// langsung dirotasi ke password acak. Aman dipanggil berulang: setelah rotasi,
        /// hash tidak cocok lagi dengan default jadi tidak akan dirotasi dua kali.
        /// </summary>
        private static void RotateLegacyDefaultPasswordAccounts(AppDbContext context, string seedPassword)
        {
            // Cukup cek akun seed yang diketahui; verifikasi hash supaya tidak mengubah
            // akun yang kebetulan sama emailnya tapi sudah diganti passwordnya.
            var legacyEmails = new[] { "superadmin@desawisata.go.id", "admin@desawisata.go.id" };
            var legacyDefaults = new[] { "super123", "admin123" };

            var affected = context.AdminUsers.Where(u => legacyEmails.Contains(u.Email)).ToList();
            foreach (var user in affected)
            {
                if (legacyDefaults.Any(d => PasswordHasher.Verify(d, user.PasswordHash)))
                {
                    user.PasswordHash = PasswordHasher.Hash(seedPassword);
                    Console.WriteLine($"[SECURITY] Password default publik terdeteksi pada '{user.Email}' — dirotasi otomatis. Ganti lewat menu Ganti Password.");
                }
            }
            context.SaveChanges();
        }
    }
}
