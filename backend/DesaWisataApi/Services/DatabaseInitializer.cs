using DesaWisataApi.Data;
using DesaWisataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DesaWisataApi.Services
{
    /// <summary>
    /// Semua peningkatan skema &amp; seed database yang sebelumnya memenuhi Program.cs
    /// (400+ baris SQL manual) dipindah ke sini agar startup tetap terbaca.
    ///
    /// Catatan arah ke depan: idealnya semua ini digantikan EF Core Migrations;
    /// pendekatan idempoten (IF NOT EXISTS / try-catch ALTER) dipertahankan karena
    /// database produksi pengguna sudah terbentuk tanpa riwayat migrasi.
    /// </summary>
    public static class DatabaseInitializer
    {
        public static void Initialize(AppDbContext context)
        {
            context.Database.EnsureCreated();
            Console.WriteLine("Database created/verified successfully.");

            // ===== Schema upgrade: kolom tautan eksternal desa (website/foto/video) =====
            // EnsureCreated() tidak menambah kolom pada tabel yang sudah ada, jadi kolom
            // ditambahkan manual (idempoten). Jika kolom baru saja dibuat (DB lama), isi
            // nilainya sekali dari hasil riset web agar data lama ikut ter-update.
            var linksAdded = false;
            foreach (var col in new[] { "UrlWebsite", "UrlFoto", "UrlVideo" })
            {
                try
                {
                    context.Database.ExecuteSqlRaw($"ALTER TABLE \"DesaWisata\" ADD COLUMN \"{col}\" TEXT NOT NULL DEFAULT ''");
                    linksAdded = true;
                }
                catch
                {
                    // Kolom sudah ada (DB baru dibuat dari model terbaru) -> lewati
                }
            }
            if (linksAdded)
            {
                BackfillDesaLinks(context);
                Console.WriteLine("Kolom tautan desa (website/foto/video) ditambahkan & diisi dari data riset.");
            }

            EnsurePengunjungTable(context);
            EnsurePemesananTable(context);
            EnsureDesaFotosTable(context);
            EnsurePajakColumn(context);
            EnsureApiClientsTable(context);
            EnsureAuditLogsTable(context);
            EnsureMultiTenantSchema(context);
            EnsureAppSettingsTable(context);
            EnsureSongsTable(context);

            // ===== Multi-tenant: seed organisasi & akun admin (idempoten, SETELAH tabel siap) =====
            DbSeeder.Seed(context);
            Console.WriteLine("Tenant seed verified (Organisasi + AdminUser).");

            // ===== Seed pustaka lagu bawaan (idempoten — hanya bila tabel kosong) =====
            if (!context.Songs.Any())
            {
                context.Songs.AddRange(
                    new Song { Judul = "Pompeii", Artis = "Bastille", VideoId = "F90Cw4l-8NY", Deskripsi = "Anthem dengan tepuk tangan & harmoni megah — semangat yang menenangkan", Urutan = 1, Aktif = true, CreatedAt = DateTime.UtcNow },
                    new Song { Judul = "Fix You", Artis = "Coldplay", VideoId = "k4V3Mo61fJM", Deskripsi = "Balada organ yang hangat — menenangkan hati seperti senja di desa", Urutan = 2, Aktif = true, CreatedAt = DateTime.UtcNow },
                    new Song { Judul = "Let Her Go", Artis = "Passenger", VideoId = "RBumgq5yVrA", Deskripsi = "Gitar akustik lembut — hening, penuh perenungan", Urutan = 3, Aktif = true, CreatedAt = DateTime.UtcNow },
                    new Song { Judul = "Riptide", Artis = "Vance Joy", VideoId = "uJ_1HMAGb4k", Deskripsi = "Ukulele ceria — ringan seperti angin pantai", Urutan = 4, Aktif = true, CreatedAt = DateTime.UtcNow }
                );
                context.SaveChanges();
                Console.WriteLine("Pustaka lagu bawaan di-seed (4 lagu).");
            }

            // ===== Cleanup: tabel legacy "AdminUser" (tunggal, tanpa data) =====
            // Tabel aktif adalah "AdminUsers" (plural, sesuai nama DbSet). Tabel tunggal adalah
            // sisa migrasi lama yang selalu kosong — dihapus idempoten saat startup.
            context.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS \"AdminUser\";");
            Console.WriteLine("Legacy 'AdminUser' table cleanup verified.");
        }

        private static void BackfillDesaLinks(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                UPDATE "DesaWisata" SET "UrlWebsite"='https://www.facebook.com/desawisatakotabatu/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=wisata+kota+batu+kebun+apel', "UrlVideo"='https://www.tiktok.com/@tiara.apel/video/7495915517249621303' WHERE "Id"=1;
                UPDATE "DesaWisata" SET "Kecamatan"='Glagah', "UrlWebsite"='https://kemiren.com', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wisata+osing+kemiren+banyuwangi', "UrlVideo"='https://www.tiktok.com/@desakemiren/video/7473885758869277959' WHERE "Id"=9;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa/ngebel', "UrlFoto"='https://www.google.com/search?tbm=isch&q=telaga+ngebel+ponorogo', "UrlVideo"='https://www.tiktok.com/@ponorogo.update/video/7652397817327062280' WHERE "Id"=11;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://atourin.com/v/dewi-podokoyo', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wisata+podokoyo+tosari', "UrlVideo"='https://www.tiktok.com/discover/desawisatapodokoyo' WHERE "Id"=12;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://www.pariwisata.denpasarkota.go.id/artikel/sanur-kauh-sebagai-desa-wisata-populer-di-kota-denpasar', "UrlFoto"='https://www.google.com/search?tbm=isch&q=pantai+sanur+bali+sunrise', "UrlVideo"='https://www.tiktok.com/@baliinseconds/video/7629235045785472264' WHERE "Id"=2;
                UPDATE "DesaWisata" SET "Kecamatan"='Bangli', "UrlWebsite"='https://penglipuran.com', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+penglipuran+bali', "UrlVideo"='https://www.tiktok.com/@balitopholiday/video/7657397490940972309' WHERE "Id"=6;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa/sidemen', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+sidemen+karangasem+sawah', "UrlVideo"='https://www.tiktok.com/@sidemetrekking/video/7665567987600035090' WHERE "Id"=13;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://gianyarkab.go.id/informasi-publik/berita/serah-terima-pengelolaan-pasar-seni-sukawati-blok-c', "UrlFoto"='https://www.google.com/search?tbm=isch&q=pasar+seni+sukawati+bali', "UrlVideo"='https://www.tiktok.com/@melalibali/video/7091191233179176218' WHERE "Id"=14;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://wisatadieng.id', "UrlFoto"='https://www.google.com/search?tbm=isch&q=dataran+tinggi+dieng+kawah+sikidang', "UrlVideo"='https://www.tiktok.com/@wisatabanjarnegara/video/7654173344618646804' WHERE "Id"=3;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa', "UrlFoto"='https://www.google.com/search?tbm=isch&q=wisata+embung+klaten', "UrlVideo"='https://www.tiktok.com/@gozajatinom171/video/7588100396506221845' WHERE "Id"=15;
                UPDATE "DesaWisata" SET "UrlWebsite"='http://www.dewikandri.com', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wisata+kandri+semarang', "UrlVideo"='https://www.tiktok.com/@kandri_wae/video/7640850999900967' WHERE "Id"=16;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://www.instagram.com/kampungnaga_tasikmalaya/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=kampung+naga+neglasari+tasikmalaya', "UrlVideo"='https://www.tiktok.com/@pesonaindonesia/video/7563242085298556168' WHERE "Id"=4;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://profil.digitaldesa.id/megamendung-bogorkab/wisata/curug-7-cilember', "UrlFoto"='https://www.google.com/search?tbm=isch&q=curug+7+cilember+bogor', "UrlVideo"='https://www.tiktok.com/@risalaldifii/video/7310160671386144005' WHERE "Id"=17;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa/alamendah', "UrlFoto"='https://www.google.com/search?tbm=isch&q=majalaya+bandung+kebun+teh', "UrlVideo"='https://www.tiktok.com/@inamarliani2/video/7646742333496495381' WHERE "Id"=18;
                UPDATE "DesaWisata" SET "Kecamatan"='Patuk', "UrlWebsite"='https://desanglanggeran.gunungkidulkab.go.id/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wisata+nglanggeran+embung', "UrlVideo"='https://www.tiktok.com/@gunungapipurba' WHERE "Id"=5;
                UPDATE "DesaWisata" SET "Kecamatan"='Turi', "UrlWebsite"='https://desawisatapulesari.wordpress.com/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wisata+pulesari+sleman', "UrlVideo"='https://www.tiktok.com/@desawisatapulesari/video/7627464458549579016' WHERE "Id"=19;
                UPDATE "DesaWisata" SET "Kecamatan"='Karangmojo', "UrlWebsite"='https://guapindul.com/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=cave+tubing+goa+pindul', "UrlVideo"='https://www.tiktok.com/@goa.pindul/video/7677398145529040136' WHERE "Id"=20;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa', "UrlFoto"='https://www.google.com/search?tbm=isch&q=kota+ende+flores+wisata', "UrlVideo"='https://www.tiktok.com/@dymnflo/video/7483175122329718021' WHERE "Id"=7;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://www.waereboofficial.com/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+wae+rebo+mbaru+niang', "UrlVideo"='https://www.tiktok.com/@breeeyani/video/7629760145848831252' WHERE "Id"=21;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://gomandalika.com/destinasi/desa-sade/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=desa+adat+sade+lombok', "UrlVideo"='https://www.tiktok.com/@pesonaindonesia/video/7525407622967676167' WHERE "Id"=22;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://toraja.info/daya-tarik/objek-wisata/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=tana+toraja+tongkonan+kebun+teh', "UrlVideo"='https://www.tiktok.com/@ayoketoraja' WHERE "Id"=8;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa/rammangrammang', "UrlFoto"='https://www.google.com/search?tbm=isch&q=rammang+rammang+maros+karst', "UrlVideo"='https://www.tiktok.com/@irasmadalle/video/7497860124124482821' WHERE "Id"=10;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://jadesta.kemenpar.go.id/desa/sungai_kupah', "UrlFoto"='https://www.google.com/search?tbm=isch&q=wisata+sungai+kapuas+kubu+raya', "UrlVideo"='https://www.tiktok.com/@khairilqpm/video/7651656249594924306' WHERE "Id"=23;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://tangkahan.id/en/', "UrlFoto"='https://www.google.com/search?tbm=isch&q=tangkahan+sumatera+gajah+sungai', "UrlVideo"='https://www.tiktok.com/@tangkahan_/video/7620992257809829140' WHERE "Id"=24;
                UPDATE "DesaWisata" SET "UrlWebsite"='https://visitpariaman.com', "UrlFoto"='https://www.google.com/search?tbm=isch&q=pantai+gandoriah+pariaman', "UrlVideo"='https://www.tiktok.com/@nyonyage/video/7656808418925202708' WHERE "Id"=25;
                """);
        }

        private static void EnsurePengunjungTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "Pengunjung" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pengunjung" PRIMARY KEY AUTOINCREMENT,
                    "DesaWisataId" INTEGER NOT NULL,
                    "NomorKarcis" TEXT NOT NULL,
                    "NamaWisatawan" TEXT NOT NULL,
                    "KategoriTiket" TEXT NOT NULL,
                    "CheckInAt" TEXT NOT NULL,
                    "CheckOutAt" TEXT NULL,
                    CONSTRAINT "FK_Pengunjung_DesaWisata_DesaWisataId" FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_Pengunjung_DesaWisataId" ON "Pengunjung" ("DesaWisataId");
                """);
            Console.WriteLine("Pengunjung table verified (schema upgrade).");
        }

        private static void EnsurePemesananTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "Pemesanan" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pemesanan" PRIMARY KEY AUTOINCREMENT,
                    "DesaWisataId" INTEGER NOT NULL,
                    "NomorBooking" TEXT NOT NULL,
                    "NamaWisatawan" TEXT NOT NULL,
                    "KategoriTiket" TEXT NOT NULL,
                    "TanggalBooking" TEXT NOT NULL,
                    "TanggalKunjungan" TEXT NOT NULL,
                    "UrlFoto" TEXT NOT NULL,
                    "Status" TEXT NOT NULL,
                    "CheckInAt" TEXT NULL,
                    "PengunjungId" INTEGER NULL,
                    CONSTRAINT "FK_Pemesanan_DesaWisata_DesaWisataId" FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_Pemesanan_DesaWisataId" ON "Pemesanan" ("DesaWisataId");
                """);
            Console.WriteLine("Pemesanan table created (schema upgrade).");
        }

        private static void EnsureDesaFotosTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "DesaFotos" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_DesaFoto" PRIMARY KEY AUTOINCREMENT,
                    "DesaWisataId" INTEGER NOT NULL,
                    "Url" TEXT NOT NULL,
                    "Judul" TEXT NOT NULL DEFAULT '',
                    "Tipe" TEXT NOT NULL DEFAULT 'foto',
                    "Urutan" INTEGER NOT NULL DEFAULT 0,
                    "CreatedAt" TEXT NOT NULL,
                    CONSTRAINT "FK_DesaFotos_DesaWisata_DesaWisataId" FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS "IX_DesaFotos_DesaWisataId" ON "DesaFotos" ("DesaWisataId");
                """);
            // Kolom Tipe (foto/video) ditambahkan belakangan — tambah untuk DB lama yang belum punya
            var hasTipeColumn = ColumnExists(context, "DesaFotos", "Tipe");
            if (!hasTipeColumn)
            {
                context.Database.ExecuteSqlRaw("ALTER TABLE \"DesaFotos\" ADD COLUMN \"Tipe\" TEXT NOT NULL DEFAULT 'foto'");
                Console.WriteLine("DesaFotos.Tipe column added (schema upgrade).");
            }
            Console.WriteLine("DesaFotos table verified (schema upgrade).");
        }

        private static void EnsurePajakColumn(AppDbContext context)
        {
            if (!ColumnExists(context, "DesaWisata", "PersenPajakDaerah"))
            {
                context.Database.ExecuteSqlRaw("ALTER TABLE \"DesaWisata\" ADD COLUMN \"PersenPajakDaerah\" REAL NOT NULL DEFAULT 10");
                Console.WriteLine("DesaWisata.PersenPajakDaerah column added (schema upgrade).");
            }
        }

        private static void EnsureApiClientsTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "ApiClients" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_ApiClient" PRIMARY KEY AUTOINCREMENT,
                    "NamaWebsite" TEXT NOT NULL,
                    "UrlWebsite" TEXT NOT NULL DEFAULT '',
                    "EmailKontak" TEXT NOT NULL DEFAULT '',
                    "KeyHash" TEXT NOT NULL,
                    "KeyPreview" TEXT NOT NULL DEFAULT '',
                    "OrganisasiId" INTEGER NOT NULL,
                    "Aktif" INTEGER NOT NULL DEFAULT 1,
                    "CreatedAt" TEXT NOT NULL,
                    "LastUsedAt" TEXT NULL,
                    "JumlahRequest" INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT "FK_ApiClients_Organisasi_OrganisasiId" FOREIGN KEY ("OrganisasiId") REFERENCES "Organisasi" ("Id") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_ApiClients_KeyHash" ON "ApiClients" ("KeyHash");
                """);
            Console.WriteLine("ApiClients table verified (schema upgrade).");
        }

        private static void EnsureAuditLogsTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "AuditLogs" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_AuditLog" PRIMARY KEY AUTOINCREMENT,
                    "CreatedAt" TEXT NOT NULL,
                    "UserId" INTEGER NULL,
                    "Email" TEXT NOT NULL DEFAULT '',
                    "Role" TEXT NOT NULL DEFAULT '',
                    "Aksi" TEXT NOT NULL,
                    "Keterangan" TEXT NOT NULL DEFAULT '',
                    "Entitas" TEXT NOT NULL DEFAULT '',
                    "EntitasId" INTEGER NULL,
                    "IpAddress" TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS "IX_AuditLogs_CreatedAt" ON "AuditLogs" ("CreatedAt" DESC);
                CREATE INDEX IF NOT EXISTS "IX_AuditLogs_Aksi" ON "AuditLogs" ("Aksi");
                """);
            Console.WriteLine("AuditLogs table verified (schema upgrade).");
        }

        private static void EnsureMultiTenantSchema(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "Organisasi" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_Organisasi" PRIMARY KEY AUTOINCREMENT,
                    "NamaOrganisasi" TEXT NOT NULL,
                    "Deskripsi" TEXT NOT NULL DEFAULT '',
                    "Kontak" TEXT NOT NULL DEFAULT '',
                    "Email" TEXT NOT NULL DEFAULT '',
                    "Aktif" INTEGER NOT NULL DEFAULT 1,
                    "CreatedAt" TEXT NOT NULL
                );
                """);
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "AdminUsers" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_AdminUser" PRIMARY KEY AUTOINCREMENT,
                    "Email" TEXT NOT NULL,
                    "PasswordHash" TEXT NOT NULL,
                    "NamaLengkap" TEXT NOT NULL DEFAULT '',
                    "Role" TEXT NOT NULL,
                    "OrganisasiId" INTEGER NULL,
                    "Aktif" INTEGER NOT NULL DEFAULT 1,
                    "CreatedAt" TEXT NOT NULL,
                    CONSTRAINT "FK_AdminUser_Organisasi_OrganisasiId" FOREIGN KEY ("OrganisasiId") REFERENCES "Organisasi" ("Id") ON DELETE SET NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_AdminUsers_Email" ON "AdminUsers" ("Email");
                """);
            // Kolom tenant di desa wisata (backfill ke organisasi default dilakukan DbSeeder)
            try
            {
                context.Database.ExecuteSqlRaw("ALTER TABLE \"DesaWisata\" ADD COLUMN \"OrganisasiId\" INTEGER NOT NULL DEFAULT 1");
            }
            catch
            {
                // Kolom sudah ada -> lewati
            }
            Console.WriteLine("Multi-tenant schema (Organisasi, AdminUser, DesaWisata.OrganisasiId) verified.");
        }

        private static void EnsureAppSettingsTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "AppSettings" (
                    "Key" TEXT NOT NULL CONSTRAINT "PK_AppSetting" PRIMARY KEY,
                    "Value" TEXT NOT NULL DEFAULT '',
                    "UpdatedAt" TEXT NOT NULL,
                    "UpdatedBy" TEXT NOT NULL DEFAULT ''
                );
                """);
            Console.WriteLine("AppSettings table verified (schema upgrade).");
        }

        private static void EnsureSongsTable(AppDbContext context)
        {
            context.Database.ExecuteSqlRaw("""
                CREATE TABLE IF NOT EXISTS "Songs" (
                    "Id" INTEGER NOT NULL CONSTRAINT "PK_Song" PRIMARY KEY AUTOINCREMENT,
                    "Judul" TEXT NOT NULL DEFAULT '',
                    "Artis" TEXT NOT NULL DEFAULT '',
                    "VideoId" TEXT NOT NULL DEFAULT '',
                    "Deskripsi" TEXT NOT NULL DEFAULT '',
                    "Urutan" INTEGER NOT NULL DEFAULT 0,
                    "Aktif" INTEGER NOT NULL DEFAULT 1,
                    "CreatedAt" TEXT NOT NULL,
                    "UpdatedBy" TEXT NOT NULL DEFAULT ''
                );
                """);
            Console.WriteLine("Songs table verified (schema upgrade).");
        }

        /// <summary>Cek keberadaan kolom via pragma_table_info (idempoten, aman dipanggil berulang).</summary>
        private static bool ColumnExists(AppDbContext context, string table, string column)
        {
            context.Database.OpenConnection();
            try
            {
                using var cmd = context.Database.GetDbConnection().CreateCommand();
                cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = '{column}'";
                return Convert.ToInt64(cmd.ExecuteScalar()) > 0;
            }
            finally
            {
                context.Database.CloseConnection();
            }
        }
    }
}
