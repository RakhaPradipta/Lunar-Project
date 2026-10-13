using Microsoft.EntityFrameworkCore;
using DesaWisataApi.Models;

namespace DesaWisataApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<DesaWisata> DesaWisata { get; set; } = null!;

        public DbSet<Pengunjung> Pengunjung { get; set; } = null!;

        public DbSet<Pemesanan> Pemesanan { get; set; } = null!;

        public DbSet<Organisasi> Organisasi { get; set; } = null!;

        public DbSet<AdminUser> AdminUsers { get; set; } = null!;

        public DbSet<DesaFoto> DesaFotos { get; set; } = null!;

        public DbSet<ApiClient> ApiClients { get; set; } = null!;

        public DbSet<AuditLog> AuditLogs { get; set; } = null!;

        public DbSet<AppSetting> AppSettings { get; set; } = null!;

        public DbSet<Song> Songs { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Pengunjung>(entity =>
            {
                entity.HasOne(p => p.DesaWisata)
                    .WithMany()
                    .HasForeignKey(p => p.DesaWisataId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Pemesanan>(entity =>
            {
                entity.HasOne(p => p.DesaWisata)
                    .WithMany()
                    .HasForeignKey(p => p.DesaWisataId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<DesaWisata>(entity =>
            {
                entity.HasOne(d => d.Organisasi)
                    .WithMany()
                    .HasForeignKey(d => d.OrganisasiId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AdminUser>(entity =>
            {
                entity.HasIndex(u => u.Email).IsUnique();
                entity.HasOne(u => u.Organisasi)
                    .WithMany()
                    .HasForeignKey(u => u.OrganisasiId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<DesaFoto>(entity =>
            {
                entity.HasOne(f => f.DesaWisata)
                    .WithMany()
                    .HasForeignKey(f => f.DesaWisataId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(f => f.DesaWisataId);
            });

            modelBuilder.Entity<ApiClient>(entity =>
            {
                entity.HasOne(c => c.Organisasi)
                    .WithMany()
                    .HasForeignKey(c => c.OrganisasiId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(c => c.KeyHash).IsUnique();
            });

            // ===== FIX: seed organisasi default di level model =====
            // Seed DesaWisata di bawah mereferensikan OrganisasiId=1. Dulu organisasi
            // hanya di-seed oleh DbSeeder yang berjalan SETELAH EnsureCreated() —
            // akibatnya pembuatan database BARU (deployment bersih/Docker/mesin lain)
            // selalu crash saat startup dengan 'FOREIGN KEY constraint failed' karena
            // baris desa seed disisipkan sebelum organisasi pemiliknya ada.
            // Dengan HasData ini EF menyisipkan Organisasi sebelum DesaWisata saat
            // EnsureCreated membuat skema. DbSeeder tetap idempoten (baris sudah ada
            // -> dilewati), dan database lama tidak terpengaruh (EnsureCreated tidak
            // menjalankan ulang seed pada DB yang sudah ada). Akun admin tetap
            // di-seed runtime via DbSeeder karena hash password harus dibuat runtime.
            modelBuilder.Entity<Organisasi>().HasData(new Organisasi
            {
                Id = 1,
                NamaOrganisasi = "Organisasi Pusat DesaWisata",
                Deskripsi = "Organisasi default pemilik seluruh desa wisata seed.",
                Kontak = "-",
                Email = "pusat@desawisata.go.id",
                Aktif = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            });

            modelBuilder.Entity<DesaWisata>().HasData(
                // ===== JAWA TIMUR =====
                new DesaWisata
                {
                    Id = 1,
                    NamaDesa = "Desa Wisata Batu Malang",
                    UrlWebsite = "https://www.facebook.com/desawisatakotabatu/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=wisata+kota+batu+kebun+apel",
                    UrlVideo = "https://www.tiktok.com/@tiara.apel/video/7495915517249621303",
                    Kecamatan = "Batu",
                    Kabupaten = "Batu",
                    Provinsi = "Jawa Timur",
                    Deskripsi = "Kota Batu terkenal sebagai kota apel dengan berbagai wisata alam seperti Jatim Park, Museum Satwa, dan petik apel. Nikmati udara sejuk pegunungan dan pemandangan hijau yang memukau.",
                    Lokasi = "Jl. Abdul Gani, Batu, Malang",
                    UrlGambar = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                    Rating = 5,
                    JumlahWisatawan = 250000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.8673,
                    Longitude = 112.5239
                },
                new DesaWisata
                {
                    Id = 9,
                    NamaDesa = "Desa Wisata Kemiren Banyuwangi",
                    UrlWebsite = "https://kemiren.com",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wisata+osing+kemiren+banyuwangi",
                    UrlVideo = "https://www.tiktok.com/@desakemiren/video/7473885758869277959",
                    Kecamatan = "Glagah",
                    Kabupaten = "Banyuwangi",
                    Provinsi = "Jawa Timur",
                    Deskripsi = "Kampung Osing dengan warisan budaya Suku Using yang unik. Wisata kuliner khas, tari-tarian tradisional, dan kehidupan desa yang tenang di tengah kebun kopi.",
                    Lokasi = "Kemiren, Glenmore, Banyuwangi",
                    UrlGambar = "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
                    Rating = 4,
                    JumlahWisatawan = 70000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.2517,
                    Longitude = 114.2039
                },
                new DesaWisata
                {
                    Id = 11,
                    NamaDesa = "Desa Wisata Ngebel Ponorogo",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa/ngebel",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=telaga+ngebel+ponorogo",
                    UrlVideo = "https://www.tiktok.com/@ponorogo.update/video/7652397817327062280",
                    Kecamatan = "Ngebel",
                    Kabupaten = "Ponorogo",
                    Provinsi = "Jawa Timur",
                    Deskripsi = "Danau vulkanik indah di kaki Gunung Wilis. Air jernih kebiruan dikelilingi hutan pinus rimbun. Spot memancing, berperahu, dan menikmati sunset yang memukau.",
                    Lokasi = "Ngebel, Ponorogo, Jawa Timur",
                    UrlGambar = "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
                    Rating = 4,
                    JumlahWisatawan = 55000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.8167,
                    Longitude = 111.6500
                },
                new DesaWisata
                {
                    Id = 12,
                    NamaDesa = "Desa Wisata Podokoyo Pasuruan",
                    UrlWebsite = "https://atourin.com/v/dewi-podokoyo",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wisata+podokoyo+tosari",
                    UrlVideo = "https://www.tiktok.com/discover/desawisatapodokoyo",
                    Kecamatan = "Tosari",
                    Kabupaten = "Pasuruan",
                    Provinsi = "Jawa Timur",
                    Deskripsi = "Pintu gerbang menuju Gunung Bromo dari sisi selatan. Perkebunan sayur di lereng gunung dengan panorama spektakuler saat kabut pagi menyelimuti lembah.",
                    Lokasi = "Podokoyo, Tosari, Pasuruan",
                    UrlGambar = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
                    Rating = 5,
                    JumlahWisatawan = 95000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.8222,
                    Longitude = 112.8917
                },

                // ===== BALI =====
                new DesaWisata
                {
                    Id = 2,
                    NamaDesa = "Desa Wisata Sanur Bali",
                    UrlWebsite = "https://www.pariwisata.denpasarkota.go.id/artikel/sanur-kauh-sebagai-desa-wisata-populer-di-kota-denpasar",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=pantai+sanur+bali+sunrise",
                    UrlVideo = "https://www.tiktok.com/@baliinseconds/video/7629235045785472264",
                    Kecamatan = "Denpasar Selatan",
                    Kabupaten = "Denpasar",
                    Provinsi = "Bali",
                    Deskripsi = "Sanur adalah pantai tenang yang sempurna untuk snorkeling dan menikmati sunrise. Pantai berpasir putih dengan perairan jernih dan terumbu karang yang indah.",
                    Lokasi = "Sanur, Denpasar, Bali",
                    UrlGambar = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
                    Rating = 5,
                    JumlahWisatawan = 180000,
                    Kategori = "Pantai",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.6841,
                    Longitude = 115.2631
                },
                new DesaWisata
                {
                    Id = 6,
                    NamaDesa = "Desa Wisata Penglipuran Bangli",
                    UrlWebsite = "https://penglipuran.com",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+penglipuran+bali",
                    UrlVideo = "https://www.tiktok.com/@balitopholiday/video/7657397490940972309",
                    Kecamatan = "Bangli",
                    Kabupaten = "Bangli",
                    Provinsi = "Bali",
                    Deskripsi = "Desa terbersih di dunia! Penglipuran menawarkan arsitektur tradisional Bali yang autentik dengan jalan-jalan bersih, taman-taman asri, dan kehidupan komunitas yang harmonis.",
                    Lokasi = "Penglipuran, Kintamani, Bangli",
                    UrlGambar = "https://images.unsplash.com/photo-1573790387438-4da905039392?w=800",
                    Rating = 5,
                    JumlahWisatawan = 150000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.4317,
                    Longitude = 115.3556
                },
                new DesaWisata
                {
                    Id = 13,
                    NamaDesa = "Desa Wisata Sidemen Karangasem",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa/sidemen",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+sidemen+karangasem+sawah",
                    UrlVideo = "https://www.tiktok.com/@sidemetrekking/video/7665567987600035090",
                    Kecamatan = "Sidemen",
                    Kabupaten = "Karangasem",
                    Provinsi = "Bali",
                    Deskripsi = "Surga tersembunyi di Bali dengan hamparan sawah berundak yang hijau memukau. Pemandangan Gunung Agung dari kejauhan, kerajinan tenun tradisional, dan villa-villa mewah berlatar alam.",
                    Lokasi = "Sidemen, Karangasem, Bali",
                    UrlGambar = "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800",
                    Rating = 5,
                    JumlahWisatawan = 85000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.5069,
                    Longitude = 115.4381
                },
                new DesaWisata
                {
                    Id = 14,
                    NamaDesa = "Desa Wisata Sukawati Gianyar",
                    UrlWebsite = "https://gianyarkab.go.id/informasi-publik/berita/serah-terima-pengelolaan-pasar-seni-sukawati-blok-c",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=pasar+seni+sukawati+bali",
                    UrlVideo = "https://www.tiktok.com/@melalibali/video/7091191233179176218",
                    Kecamatan = "Sukawati",
                    Kabupaten = "Gianyar",
                    Provinsi = "Bali",
                    Deskripsi = "Pasar seni terbesar di Bali dengan ribuan karya seni, ukiran kayu, lukisan, dan kerajinan tangan. Pengalaman berbelanja seni budaya Bali yang autentik dan harga terjangkau.",
                    Lokasi = "Sukawati, Gianyar, Bali",
                    UrlGambar = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
                    Rating = 4,
                    JumlahWisatawan = 120000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.5917,
                    Longitude = 115.2667
                },

                // ===== JAWA TENGAH =====
                new DesaWisata
                {
                    Id = 3,
                    NamaDesa = "Desa Wisata Dieng Wonosobo",
                    UrlWebsite = "https://wisatadieng.id",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=dataran+tinggi+dieng+kawah+sikidang",
                    UrlVideo = "https://www.tiktok.com/@wisatabanjarnegara/video/7654173344618646804",
                    Kecamatan = "Kejajar",
                    Kabupaten = "Wonosobo",
                    Provinsi = "Jawa Tengah",
                    Deskripsi = "Dataran Tinggi Dieng menawarkan keindahan alam yang memukau dengan kawah, telaga warna, dan candi tertua di Jawa. Nikmati keindahan golden sunrise yang terkenal.",
                    Lokasi = "Dieng, Wonosobo, Jawa Tengah",
                    UrlGambar = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
                    Rating = 4,
                    JumlahWisatawan = 120000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.2019,
                    Longitude = 109.9089
                },
                new DesaWisata
                {
                    Id = 15,
                    NamaDesa = "Desa Wisata Lembah Kovan Klaten",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=wisata+embung+klaten",
                    UrlVideo = "https://www.tiktok.com/@gozajatinom171/video/7588100396506221845",
                    Kecamatan = "Polanharjo",
                    Kabupaten = "Klaten",
                    Provinsi = "Jawa Tengah",
                    Deskripsi = "Wisata alam kekinian di pinggir sungai dengan spot foto Instagramable, camping ground, outbound, dan wisata air. Suasana pedesaan Jawa yang asri dan menenangkan.",
                    Lokasi = "Kovan, Polanharjo, Klaten",
                    UrlGambar = "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800",
                    Rating = 4,
                    JumlahWisatawan = 48000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.7167,
                    Longitude = 110.6333
                },
                new DesaWisata
                {
                    Id = 16,
                    NamaDesa = "Desa Wisata Kandri Gunungpati",
                    UrlWebsite = "http://www.dewikandri.com",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wisata+kandri+semarang",
                    UrlVideo = "https://www.tiktok.com/@kandri_wae/video/7640850998998600967",
                    Kecamatan = "Gunungpati",
                    Kabupaten = "Semarang",
                    Provinsi = "Jawa Tengah",
                    Deskripsi = "Desa wisata petik stroberi dan kelinci di lereng Gunung Ungu. Pengalaman interaktif bermain hewan, memetik buah segar, dan menikmati udara pegunungan yang sejuk.",
                    Lokasi = "Kandri, Gunungpati, Semarang",
                    UrlGambar = "https://images.unsplash.com/photo-1516214104703-d870798883c5?w=800",
                    Rating = 4,
                    JumlahWisatawan = 42000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.0833,
                    Longitude = 110.4167
                },

                // ===== JAWA BARAT =====
                new DesaWisata
                {
                    Id = 4,
                    NamaDesa = "Desa Wisata Kampung Naga Tasikmalaya",
                    UrlWebsite = "https://www.instagram.com/kampungnaga_tasikmalaya/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=kampung+naga+neglasari+tasikmalaya",
                    UrlVideo = "https://www.tiktok.com/@pesonaindonesia/video/7563242085298556168",
                    Kecamatan = "Salawu",
                    Kabupaten = "Tasikmalaya",
                    Provinsi = "Jawa Barat",
                    Deskripsi = "Kampung Naga adalah desa adat yang masih mempertahankan tradisi Sunda. Rumah-rumah tradisional di tepi sungai dengan pemandangan hijau sawah dan pepohonan rindang.",
                    Lokasi = "Neglasari, Salawu, Tasikmalaya",
                    UrlGambar = "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800",
                    Rating = 4,
                    JumlahWisatawan = 65000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.3500,
                    Longitude = 108.1167
                },
                new DesaWisata
                {
                    Id = 17,
                    NamaDesa = "Desa Wisata Cilember Bogor",
                    UrlWebsite = "https://profil.digitaldesa.id/megamendung-bogorkab/wisata/curug-7-cilember",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=curug+7+cilember+bogor",
                    UrlVideo = "https://www.tiktok.com/@risalaldifii/video/7310160671386144005",
                    Kecamatan = "Cisarua",
                    Kabupaten = "Bogor",
                    Provinsi = "Jawa Barat",
                    Deskripsi = "Wisata air terjun tujuh tingkat di kaki Gunung Salak. Trekking melalui hutan tropis yang rimbun dengan udara sejuk, jembatan gantung, dan spot camping yang Instagramable.",
                    Lokasi = "Cilember, Cisarua, Bogor",
                    UrlGambar = "https://images.unsplash.com/photo-1432405972618-c6b0c0d40b2f?w=800",
                    Rating = 4,
                    JumlahWisatawan = 78000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -6.6667,
                    Longitude = 106.9500
                },
                new DesaWisata
                {
                    Id = 18,
                    NamaDesa = "Desa Wisata Majalaya Bandung",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa/alamendah",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=majalaya+bandung+kebun+teh",
                    UrlVideo = "https://www.tiktok.com/@inamarliani2/video/7646742333496495381",
                    Kecamatan = "Majalaya",
                    Kabupaten = "Bandung",
                    Provinsi = "Jawa Barat",
                    Deskripsi = "Pengalaman Sunda autentik dengan sajian kuliner khas, rumah adat Julian, pemandian alam, dan kebun teh yang membentang. Wisata edukasi budaya Sunda yang interaktif.",
                    Lokasi = "Majalaya, Bandung, Jawa Barat",
                    UrlGambar = "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800",
                    Rating = 4,
                    JumlahWisatawan = 62000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.0500,
                    Longitude = 107.7500
                },

                // ===== YOGYAKARTA =====
                new DesaWisata
                {
                    Id = 5,
                    NamaDesa = "Desa Wisata Nglanggeran Gunung Kidul",
                    UrlWebsite = "https://desanglanggeran.gunungkidulkab.go.id/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wisata+nglanggeran+embung",
                    UrlVideo = "https://www.tiktok.com/@gunungapipurba",
                    Kecamatan = "Patuk",
                    Kabupaten = "Gunung Kidul",
                    Provinsi = "Daerah Istimewa Yogyakarta",
                    Deskripsi = "Desa wisata berbasis masyarakat dengan embung Nglanggeran, kebun buah, dan gua-gua alam. Pengalaman pedesaan autentik dengan pemandangan perbukitan kapur yang eksotis.",
                    Lokasi = "Nglanggeran, Patumpong, Gunung Kidul",
                    UrlGambar = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                    Rating = 4,
                    JumlahWisatawan = 95000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.9833,
                    Longitude = 110.6500
                },
                new DesaWisata
                {
                    Id = 19,
                    NamaDesa = "Desa Wisata Pulesari Yogyakarta",
                    UrlWebsite = "https://desawisatapulesari.wordpress.com/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wisata+pulesari+sleman",
                    UrlVideo = "https://www.tiktok.com/@desawisatapulesari/video/7627464458549579016",
                    Kecamatan = "Turi",
                    Kabupaten = "Kulon Progo",
                    Provinsi = "Daerah Istimewa Yogyakarta",
                    Deskripsi = "Desa kerajinan batik tulis tradisional Yogyakarta. Pelajari teknik batik tulis langsung dari pengrajin, ciptakan batik sendiri, dan nikmati suasana pedesaan Jawa yang tenang.",
                    Lokasi = "Pulesari, Temon, Kulon Progo",
                    UrlGambar = "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800",
                    Rating = 5,
                    JumlahWisatawan = 38000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.7500,
                    Longitude = 110.0833
                },
                new DesaWisata
                {
                    Id = 20,
                    NamaDesa = "Desa Wisata Tubingan Gunung Kidul",
                    UrlWebsite = "https://guapindul.com/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=cave+tubing+goa+pindul",
                    UrlVideo = "https://www.tiktok.com/@goa.pindul/video/7677398145529040136",
                    Kecamatan = "Karangmojo",
                    Kabupaten = "Gunung Kidul",
                    Provinsi = "Daerah Istimewa Yogyakarta",
                    Deskripsi = "Petualangan tubing di sungai bawah tanah yang spektakuler. Menyusuri terowongan gua dengan perahu karet, menikmati stalaktit dan stalagmit yang berkilauan di bawah lampu.",
                    Lokasi = "Playen, Gunung Kidul, Yogyakarta",
                    UrlGambar = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
                    Rating = 5,
                    JumlahWisatawan = 67000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -7.9500,
                    Longitude = 110.6000
                },

                // ===== NUSA TENGGARA =====
                new DesaWisata
                {
                    Id = 7,
                    NamaDesa = "Desa Wisata Lipso Ende Flores",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=kota+ende+flores+wisata",
                    UrlVideo = "https://www.tiktok.com/@dymnflo/video/7483175122329718021",
                    Kecamatan = "Ende",
                    Kabupaten = "Ende",
                    Provinsi = "Nusa Tenggara Timur",
                    Deskripsi = "Desa wisata di kaki Gunung Meja dengan hamparan savana dan pantai berpasir putih. Spot sempurna untuk melihat Danau Kelimutu dari kejauhan.",
                    Lokasi = "Lipso, Ende, Flores",
                    UrlGambar = "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
                    Rating = 4,
                    JumlahWisatawan = 45000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.8333,
                    Longitude = 121.6667
                },
                new DesaWisata
                {
                    Id = 21,
                    NamaDesa = "Desa Wisata Wae Rebo Manggarai",
                    UrlWebsite = "https://www.waereboofficial.com/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+wae+rebo+mbaru+niang",
                    UrlVideo = "https://www.tiktok.com/@breeeyani/video/7629760145848831252",
                    Kecamatan = "Satar Lenda",
                    Kabupaten = "Manggarai Barat",
                    Provinsi = "Nusa Tenggara Timur",
                    Deskripsi = "Kampung adat di puncak gunung dengan tujuh rumah kerucut tradisional Mbaru Niang. Pengalaman menginap di rumah adat, minum kopi khas, dan menikmati kabut pagi yang mistis.",
                    Lokasi = "Wae Rebo, Satar Lenda, Manggarai Barat",
                    UrlGambar = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
                    Rating = 5,
                    JumlahWisatawan = 25000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.7500,
                    Longitude = 120.1167
                },
                new DesaWisata
                {
                    Id = 22,
                    NamaDesa = "Desa Wisata Sasak Sade Lombok",
                    UrlWebsite = "https://gomandalika.com/destinasi/desa-sade/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=desa+adat+sade+lombok",
                    UrlVideo = "https://www.tiktok.com/@pesonaindonesia/video/7525407622967676167",
                    Kecamatan = "Pujut",
                    Kabupaten = "Lombok Tengah",
                    Provinsi = "Nusa Tenggara Barat",
                    Deskripsi = "Kampung tradisional Suku Sasak dengan rumah-rumah lumbung padi. Wisata budaya autentik, kerajinan tenun, dan atraksi kesenian tradisional Suku Sasak yang masih lestari.",
                    Lokasi = "Sade, Pujut, Lombok Tengah",
                    UrlGambar = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
                    Rating = 4,
                    JumlahWisatawan = 72000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -8.6833,
                    Longitude = 116.2833
                },

                // ===== SULAWESI =====
                new DesaWisata
                {
                    Id = 8,
                    NamaDesa = "Desa Wisata Toraja Sulawesi Selatan",
                    UrlWebsite = "https://toraja.info/daya-tarik/objek-wisata/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=tana+toraja+tongkonan+kebun+teh",
                    UrlVideo = "https://www.tiktok.com/@ayoketoraja",
                    Kecamatan = "Makale",
                    Kabupaten = "Tana Toraja",
                    Provinsi = "Sulawesi Selatan",
                    Deskripsi = "Keunikan budaya Toraja dengan upacara pemakaman, rumah tongkonan, dan pemandangan hijau perbukitan. Pengalaman budaya yang tak terlupakan dan mendalam.",
                    Lokasi = "Makale, Tana Toraja, Sulawesi Selatan",
                    UrlGambar = "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800",
                    Rating = 5,
                    JumlahWisatawan = 80000,
                    Kategori = "Budaya",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -3.0833,
                    Longitude = 119.8500
                },
                new DesaWisata
                {
                    Id = 10,
                    NamaDesa = "Desa Wisata Rammang-Rammang Maros",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa/rammangrammang",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=rammang+rammang+maros+karst",
                    UrlVideo = "https://www.tiktok.com/@irasmadalle/video/7497860124124482821",
                    Kecamatan = "Bontoa",
                    Kabupaten = "Maros",
                    Provinsi = "Sulawesi Selatan",
                    Deskripsi = "Surga tersembunyi di Sulawesi dengan formasi batu karst megah, sungai tenang untuk menyusuri perahu, dan desa pertanian yang asri di antara tebing-tebing kapur.",
                    Lokasi = "Rammang-Rammang, Bontoa, Maros",
                    UrlGambar = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                    Rating = 5,
                    JumlahWisatawan = 55000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -4.9167,
                    Longitude = 119.7167
                },

                // ===== KALIMANTAN =====
                new DesaWisata
                {
                    Id = 23,
                    NamaDesa = "Desa Wisata Kubu Raya Kalimantan",
                    UrlWebsite = "https://jadesta.kemenpar.go.id/desa/sungai_kupah",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=wisata+sungai+kapuas+kubu+raya",
                    UrlVideo = "https://www.tiktok.com/@khairilqpm/video/7651656249594924306",
                    Kecamatan = "Kubu",
                    Kabupaten = "Kubu Raya",
                    Provinsi = "Kalimantan Barat",
                    Deskripsi = "Wisata sungai Kapuas dengan perahu tradisional menyusuri hutan bakau, spot memancing ikan arwana, dan kunjungan ke desa nelayan tradisional di muara sungai terpanjang di Indonesia.",
                    Lokasi = "Kubu, Kubu Raya, Kalimantan Barat",
                    UrlGambar = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                    Rating = 4,
                    JumlahWisatawan = 32000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = 0.0833,
                    Longitude = 109.3333
                },

                // ===== SUMATERA =====
                new DesaWisata
                {
                    Id = 24,
                    NamaDesa = "Desa Wisata Tangkahan Langkat",
                    UrlWebsite = "https://tangkahan.id/en/",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=tangkahan+sumatera+gajah+sungai",
                    UrlVideo = "https://www.tiktok.com/@tangkahan_/video/7620992257809829140",
                    Kecamatan = "Batang Serangan",
                    Kabupaten = "Langkat",
                    Provinsi = "Sumatera Utara",
                    Deskripsi = "Surga ecotourism di hutan hujan Sumatera. Berinteraksi dengan gajah liar di sungai, trekking hutan tropis, mandi di air terjun alami, dan pengalaman desa hutan yang unik.",
                    Lokasi = "Tangkahan, Batang Serangan, Langkat",
                    UrlGambar = "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800",
                    Rating = 5,
                    JumlahWisatawan = 48000,
                    Kategori = "Alam",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = 3.4667,
                    Longitude = 98.1833
                },
                new DesaWisata
                {
                    Id = 25,
                    NamaDesa = "Desa Wisata Pariaman Sumatera Barat",
                    UrlWebsite = "https://visitpariaman.com",
                    UrlFoto = "https://www.google.com/search?tbm=isch&q=pantai+gandoriah+pariaman",
                    UrlVideo = "https://www.tiktok.com/@nyonyage/video/7656808418925202708",
                    Kecamatan = "Pariaman Tengah",
                    Kabupaten = "Kota Pariaman",
                    Provinsi = "Sumatera Barat",
                    Deskripsi = "Pantai berpasir putih dengan snorkeling terumbu karang, festival tabuik tahunan, kuliner seafood segar, dan pemandangan sunset spektakuler dari dermaga kayu tradisional Minang.",
                    Lokasi = "Pariaman Tengah, Kota Pariaman",
                    UrlGambar = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800",
                    Rating = 4,
                    JumlahWisatawan = 58000,
                    Kategori = "Pantai",
                    Aktif = true, OrganisasiId = 1, BatasPengunjung = 300, PengunjungHariIni = 180,
                    Latitude = -0.6167,
                    Longitude = 100.1167
                }
            );
        }
    }
}
