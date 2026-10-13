using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using DesaWisataApi.Data;
using DesaWisataApi.Models;
using DesaWisataApi.Services;
using System.Threading.RateLimiting;

// ===== Loader file .env (opsional, untuk deployment sederhana) =====
// HARUS berjalan SEBELUM CreateBuilder agar nilainya ikut ter-snapshot ke
// IConfiguration (GROQ_API_KEY, dll. dibaca lewat configuration).
// Dicari mulai dari folder kerja ke atas sampai root (folder kerja biasanya
// folder API saat `dotnet run`, atau root repo saat dijalankan dari root).
// Tanpa menimpa env var yang sudah ada dari platform (Docker/systemd menang).
LoadDotEnvFile();

var builder = WebApplication.CreateBuilder(args);

// Configure SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=desawisata.db"));

// ===== AI AGENT (WisataBot) =====
builder.Services.AddHttpClient();
builder.Services.AddScoped<AiAgentService>();

// ===== CORS =====
// Development: izinkan localhost (port apa pun) untuk Vite dev server.
// Production: set env CORS_ORIGINS="https://domain-anda.com,https://www.domain-anda.com"
var corsOriginsEnv = builder.Configuration["CORS_ORIGINS"] ?? Environment.GetEnvironmentVariable("CORS_ORIGINS");
var allowedOrigins = (corsOriginsEnv ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToArray();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            // Production: whitelist eksplisit
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
        else
        {
            // Development: hanya localhost. BUKAN allow-all (tidak pernah Combine dengan AllowCredentials).
            policy.SetIsOriginAllowed(origin =>
            {
                if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return uri.Host is "localhost" or "127.0.0.1" or "[::1]";
                }
                return false;
            }).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ===== RATE LIMITING (anti brute-force & spam) =====
// Kebijakan "auth": login/register — 10 request / menit per IP.
// Kebijakan "register-site": pendaftaran website publik — 5 request / menit per IP.
// Kebijakan "booking": pemesanan tiket publik — 8 request / menit per IP (anti spam DB).
// Kebijakan "ai-chat": chatbot LLM — 10 request / menit per IP (melindungi kuota API Groq).
// Kebijakan "public": endpoint baca publik — 120 request / menit per IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.OnRejected = (context, _) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        return ValueTask.CompletedTask;
    };

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));

    options.AddPolicy("register-site", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));

    options.AddPolicy("booking", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 8, Window = TimeSpan.FromMinutes(1) }));

    options.AddPolicy("ai-chat", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));

    options.AddPolicy("public", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) }));
});

// ===== TOKEN REVOCATION (logout server-side) =====
builder.Services.AddSingleton<TokenRevocationService>();

// ===== RESET HARIAN (tengah malam WIB) =====
builder.Services.AddHostedService<DailyResetService>();

// ===== FLUSH METRIK API KLIEN (tiap 60 detik) =====
builder.Services.AddHostedService<MetricsFlushService>();

// ===== MULTI-TENANT AUTH (JWT) =====
// Secret WAJIB dari config/env. Bila tidak ada:
// - Development: disimpan ke file lokal "jwt_dev_secret.txt" sehingga token TETAP VALID
//   setelah backend di-restart (dulu digenerate acak tiap startup -> semua sesi login
//   langsung 401 "Login diperlukan" begitu `dotnet run` dijalankan ulang).
// - Production: digenerate acak per startup + peringatan (wajib set JWT_SECRET_KEY).
var jwtSecret = builder.Configuration["Jwt:SecretKey"] ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY");
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.StartsWith("desawisata-super-secret", StringComparison.Ordinal))
{
    var devSecretFile = Path.Combine(builder.Environment.ContentRootPath, "jwt_dev_secret.txt");
    if (builder.Environment.IsDevelopment())
    {
        try
        {
            if (File.Exists(devSecretFile))
                jwtSecret = File.ReadAllText(devSecretFile).Trim();
        }
        catch { /* baca gagal -> generate baru */ }
        if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
        {
            jwtSecret = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            File.WriteAllText(devSecretFile, jwtSecret);
            Console.WriteLine($"[SECURITY] JWT secret development disimpan ke {devSecretFile} (token tetap valid antar restart). Set JWT_SECRET_KEY untuk production.");
        }
    }
    else
    {
        jwtSecret = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
        Console.WriteLine("[SECURITY] JWT secret tidak dikonfigurasi — digenerate acak sementara (token invalid setelah restart). Set JWT_SECRET_KEY untuk production.");
    }
}
if (jwtSecret.Length < 32)
{
    throw new InvalidOperationException("JWT secret harus minimal 32 karakter (set JWT_SECRET_KEY / Jwt:SecretKey).");
}

builder.Services.AddSingleton(new JwtService(builder.Configuration, jwtSecret));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection("Jwt");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"] ?? "DesaWisataApi",
            ValidateAudience = true,
            ValidAudience = jwt["Audience"] ?? "DesaWisataFrontend",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        // ===== TOKEN REVOCATION: tolak token yang sudah di-logout (blacklist jti) =====
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var revocation = context.HttpContext.RequestServices.GetRequiredService<TokenRevocationService>();
                var jti = context.Principal?.FindFirst("jti")?.Value;
                if (revocation.IsRevoked(jti))
                {
                    context.Fail("Token telah direvoke (logout).");
                }
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// CORS HARUS sebelum auth: kalau sesudah, respons 401/403 dari [Authorize] di-short-circuit
// sebelum melewati middleware CORS sehingga TIDAK membawa header Access-Control-Allow-Origin.
// Browser lalu memblokir responsnya -> fetch melempar "Failed to fetch" alih-alih status 401.
app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseAuthorization();

// Apply migrations and seed data on startup — dipindah ke Services/DatabaseInitializer.cs
// agar Program.cs tetap ringkas (dulu 400+ baris SQL manual di sini).
try
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        DatabaseInitializer.Initialize(context);
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Database error: {ex.Message}");
    throw;
}

// Ensure uploads directory exists
var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(uploadsPath))
    Directory.CreateDirectory(uploadsPath);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();

// ===== Security headers =====
app.Use(async (context, next) =>
{
    var res = context.Response;
    res.Headers.XContentTypeOptions = "nosniff";          // cegah MIME sniffing
    res.Headers.XFrameOptions = "DENY";                    // cegah clickjacking
    res.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    res.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
    if (!builder.Environment.IsDevelopment())
    {
        // HSTS: paksa browser memakai HTTPS selama 1 tahun (backend di belakang reverse proxy TLS)
        res.Headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
    }
    if (!res.Headers.ContainsKey("Content-Security-Policy"))
    {
        // Frame-ancestors none = versi modern X-Frame-Options
        res.Headers.ContentSecurityPolicy = "frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
    }
    await next();
});

// Serve uploaded files as static files
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        Path.Combine(app.Environment.ContentRootPath, "uploads")),
    RequestPath = "/uploads"
});

app.MapControllers();

Console.WriteLine("DesaWisata API started successfully on http://localhost:5200");

app.Run();

// ===== Loader file .env — dipanggil di atas, sebelum CreateBuilder =====
static void LoadDotEnvFile()
{
    try
    {
        // Cari .env mulai dari folder kerja naik ke atas (maks 4 level) sampai root repo.
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (var i = 0; i < 4 && dir != null; i++)
        {
            var candidate = Path.Combine(dir.FullName, ".env");
            if (File.Exists(candidate))
            {
                foreach (var rawLine in File.ReadAllLines(candidate))
                {
                    var line = rawLine.Trim();
                    if (line.Length == 0 || line.StartsWith('#')) continue;
                    var eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    var key = line[..eq].Trim();
                    var value = line[(eq + 1)..].Trim().Trim('"');
                    if (key.Length == 0) continue;
                    // Jangan timpa env var yang sudah di-set platform (Docker/systemd menang)
                    if (Environment.GetEnvironmentVariable(key) is null)
                        Environment.SetEnvironmentVariable(key, value);
                }
                Console.WriteLine($"[CONFIG] File .env dimuat dari {candidate}");
                return;
            }
            dir = dir.Parent;
        }
        Console.WriteLine("[CONFIG] File .env tidak ditemukan — env var dibaca langsung dari environment.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[CONFIG] Gagal memuat .env (diabaikan): {ex.Message}");
    }
}