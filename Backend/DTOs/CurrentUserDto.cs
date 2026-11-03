namespace Artifax.DTOs
{
    public class CurrentUserDto
    {
        public string UserLevel { get; set; }
        public string UserEmail { get; set; }
        public string Username { get; set; }
        public int? EmployeeId { get; set; }
        public int? BranchId { get; set; }
        public string BranchName { get; set; }
    }
}
