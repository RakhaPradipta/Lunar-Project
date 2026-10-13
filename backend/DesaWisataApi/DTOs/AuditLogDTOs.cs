namespace DesaWisataApi.DTOs
{
    public class AuditLogResponse
    {
        public int Id { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Aksi { get; set; } = string.Empty;
        public string Keterangan { get; set; } = string.Empty;
        public string Entitas { get; set; } = string.Empty;
        public int? EntitasId { get; set; }
        public string IpAddress { get; set; } = string.Empty;
    }
}
