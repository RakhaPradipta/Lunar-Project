== AdminUser
CREATE TABLE "AdminUser" (
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
== AdminUsers
CREATE TABLE "AdminUsers" (
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
== DesaWisata
CREATE TABLE "DesaWisata" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_DesaWisata" PRIMARY KEY AUTOINCREMENT,
    "NamaDesa" TEXT NOT NULL,
    "Kecamatan" TEXT NOT NULL,
    "Kabupaten" TEXT NOT NULL,
    "Provinsi" TEXT NOT NULL,
    "Deskripsi" TEXT NOT NULL,
    "Lokasi" TEXT NOT NULL,
    "UrlGambar" TEXT NOT NULL,
    "Rating" INTEGER NOT NULL,
    "JumlahWisatawan" INTEGER NOT NULL,
    "Kategori" TEXT NOT NULL,
    "Aktif" INTEGER NOT NULL,
    "Latitude" REAL NOT NULL,
    "Longitude" REAL NOT NULL,
    "BatasPengunjung" INTEGER NOT NULL,
    "PengunjungHariIni" INTEGER NOT NULL,
    "Overtourism" INTEGER NOT NULL,
    "ThresholdPeringatan" INTEGER NOT NULL,
    "AutoLockOvertourism" INTEGER NOT NULL,
    "PesanPeringatan" TEXT NOT NULL,
    "StatusOperasional" TEXT NOT NULL,
    "JamBuka" TEXT NOT NULL,
    "JamTutup" TEXT NOT NULL,
    "HariOperasional" TEXT NOT NULL,
    "KontakPengelola" TEXT NOT NULL,
    "EmailPengelola" TEXT NOT NULL,
    "SocialMedia" TEXT NOT NULL,
    "HargaTiketLokal" INTEGER NOT NULL,
    "HargaTiketMancanegara" INTEGER NOT NULL,
    "HargaParkirMotor" INTEGER NOT NULL,
    "HargaParkirMobil" INTEGER NOT NULL,
    "Fasilitas" TEXT NOT NULL,
    "CreatedAt" TEXT NOT NULL,
    "UpdatedAt" TEXT NOT NULL
, "UrlWebsite" TEXT NOT NULL DEFAULT '', "UrlFoto" TEXT NOT NULL DEFAULT '', "UrlVideo" TEXT NOT NULL DEFAULT '', "OrganisasiId" INTEGER NOT NULL DEFAULT 1);
== Organisasi
CREATE TABLE "Organisasi" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Organisasi" PRIMARY KEY AUTOINCREMENT,
    "NamaOrganisasi" TEXT NOT NULL,
    "Deskripsi" TEXT NOT NULL DEFAULT '',
    "Kontak" TEXT NOT NULL DEFAULT '',
    "Email" TEXT NOT NULL DEFAULT '',
    "Aktif" INTEGER NOT NULL DEFAULT 1,
    "CreatedAt" TEXT NOT NULL
);
== Pemesanan
CREATE TABLE "Pemesanan" (
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
== Pengunjung
CREATE TABLE "Pengunjung" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pengunjung" PRIMARY KEY AUTOINCREMENT,
    "DesaWisataId" INTEGER NOT NULL,
    "NomorKarcis" TEXT NOT NULL,
    "NamaWisatawan" TEXT NOT NULL,
    "KategoriTiket" TEXT NOT NULL,
    "CheckInAt" TEXT NOT NULL,
    "CheckOutAt" TEXT NULL,
    CONSTRAINT "FK_Pengunjung_DesaWisata_DesaWisataId" FOREIGN KEY ("DesaWisataId") REFERENCES "DesaWisata" ("Id") ON DELETE CASCADE
);
== INDEXES
CREATE UNIQUE INDEX "IX_AdminUser_Email" ON "AdminUser" ("Email")  -- on AdminUser
CREATE UNIQUE INDEX "IX_AdminUsers_Email" ON "AdminUsers" ("Email")  -- on AdminUsers
CREATE INDEX "IX_Pemesanan_DesaWisataId" ON "Pemesanan" ("DesaWisataId")  -- on Pemesanan
CREATE INDEX "IX_Pengunjung_DesaWisataId" ON "Pengunjung" ("DesaWisataId")  -- on Pengunjung
(node:11892) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
