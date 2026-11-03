namespace Artifax.DTOs
{
    public class OrderCreateDto
    {
        public int ItemID { get; set; }
        public int Quantity { get; set; }
        public int BranchID { get; set; }          // Warehouse that crafts and receives the item
        public int? SourceBranchID { get; set; }   // Warehouse to take materials from (defaults to BranchID)
        public int EmployeeID { get; set; }
        public bool OrderExpedite { get; set; }
    }
}
