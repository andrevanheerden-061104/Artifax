#nullable enable
namespace Artifax.Models
{
    public class Order
    {
        public int OrderID { get; set; }
        public int ItemID { get; set; }
        public int Quantity { get; set; }
        public DateTime CreatedDateTime { get; set; } = DateTime.UtcNow;
        public DateTime? StartedDateTime { get; set; }
        public DateTime? CompletedDateTime { get; set; }
        public int TotalTime { get; set; }  // Calculated: Item.ProductionTime * Quantity (in minutes)
        public int TimeElapsed { get; set; }  // Incremented by background service (in minutes)
        public int BranchID { get; set; }  // Warehouse the item is crafted at (and delivered to)
        public int? SourceBranchID { get; set; }  // Warehouse the materials were taken from (null = same as BranchID)
        public int EmployeeID { get; set; }
        public bool OrderExpedite { get; set; }
        public string Status { get; set; } = "Queued";  // Queued, Active, Paused, Cancelled, Complete

        public Branch? Branch { get; set; }
        public Item? Item { get; set; }
        public Employee? Employee { get; set; }
        public ICollection<OrderHistory> OrderHistories { get; set; } = new List<OrderHistory>();
    }
}