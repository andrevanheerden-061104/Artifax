using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Artifax.Models;
using Artifax.Data;
using Artifax.DTOs;
using Artifax.Helpers;

namespace Artifax.Controllers
{
    /// <summary>
    /// Crafting orders. Every route is limited to the warehouse(s) the user may see:
    /// employees only ever see their own warehouse, admins see the one picked in the
    /// warehouse switcher (or all of them).
    /// </summary>
    [ApiController]
    [Route("api/[Controller]")]
    public class OrderController : ControllerBase
    {
        static readonly string[] OpenStatuses = { "Queued", "Active", "Paused" };
        const int MaxActivePerBranch = 3;

        readonly ArtifaxContext context;

        public OrderController(ArtifaxContext incoming)
        {
            context = incoming;
        }

        BranchScope Scope => BranchScope.From(HttpContext);

        IQueryable<Order> ScopedOrders()
        {
            var scope = Scope;
            var query = context.Orders.AsQueryable();
            if (scope.BranchId is int branchId)
            {
                query = query.Where(o => o.BranchID == branchId);
            }
            return query;
        }

        static OrderReadDto ToDto(Order o) => new OrderReadDto
        {
            OrderID = o.OrderID,
            ItemID = o.ItemID,
            ItemName = o.Item?.ItemName ?? "Unknown",
            Quantity = o.Quantity,
            CreatedDateTime = o.CreatedDateTime,
            StartedDateTime = o.StartedDateTime,
            CompletedDateTime = o.CompletedDateTime,
            TotalTime = o.TotalTime,
            TimeElapsed = o.TimeElapsed,
            Status = o.Status,
            BranchID = o.BranchID,
            SourceBranchID = o.SourceBranchID ?? o.BranchID,
            EmployeeID = o.EmployeeID,
            OrderExpedite = o.OrderExpedite
        };

        static ObjectResult Forbidden(string message) => new ObjectResult(message) { StatusCode = StatusCodes.Status403Forbidden };

        #region GetRoutes

        // GET /api/Order/history/all — status history for every order the user can see
        [HttpGet("history/all")]
        public async Task<IActionResult> GetAllOrderHistory()
        {
            var scope = Scope;
            var query = context.OrderHistories
                .Include(oh => oh.ChangedByEmployee)
                .AsQueryable();

            if (scope.BranchId is int branchId)
            {
                query = query.Where(oh => oh.Order.BranchID == branchId);
            }

            var history = await query
                .OrderByDescending(oh => oh.ChangedDateTime)
                .ToListAsync();

            return Ok(history.Select(ToHistoryDto).ToList());
        }

        // GET /api/Order — all orders the user can see
        [HttpGet]
        public async Task<IActionResult> GetAllOrders()
        {
            var orders = await ScopedOrders()
                .Include(o => o.Item)
                .Include(o => o.Branch)
                .ToListAsync();

            return Ok(orders.Select(ToDto).ToList());
        }

        // GET /api/Order/{id}/history
        [HttpGet("{id}/history")]
        public async Task<IActionResult> GetOrderHistory(int id)
        {
            var order = await context.Orders.FindAsync(id);
            if (order != null && !Scope.CanAccess(order.BranchID))
                return Forbidden("You can only view orders from your own warehouse.");

            var history = await context.OrderHistories
                .Where(oh => oh.OrderID == id)
                .Include(oh => oh.ChangedByEmployee)
                .OrderByDescending(oh => oh.ChangedDateTime)
                .ToListAsync();

            return Ok(history.Select(ToHistoryDto).ToList());
        }

        // GET /api/Order/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetOrderById(int id)
        {
            var order = await context.Orders
                .Include(o => o.Item)
                .Include(o => o.Branch)
                .FirstOrDefaultAsync(o => o.OrderID == id);

            if (order == null)
                return NotFound($"Order with ID {id} not found.");

            if (!Scope.CanAccess(order.BranchID))
                return Forbidden("You can only view orders from your own warehouse.");

            return Ok(ToDto(order));
        }

        static OrderHistoryReadDto ToHistoryDto(OrderHistory h) => new OrderHistoryReadDto
        {
            OrderHistoryID = h.OrderHistoryID,
            OrderID = h.OrderID,
            PreviousStatus = h.PreviousStatus,
            NewStatus = h.NewStatus,
            ChangedDateTime = h.ChangedDateTime,
            ChangedByEmployeeID = h.ChangedByEmployeeID,
            ChangedByEmployeeName = h.ChangedByEmployee?.EmployeeName ?? "System",
            ChangeReason = h.ChangeReason
        };

        #endregion

        #region CreateRoutes

        // POST /api/Order/create
        // Body: { itemID, quantity, branchID, sourceBranchID?, employeeID, orderExpedite }
        // Checks the blueprint's materials are in stock at the source warehouse, takes them
        // out of stock and queues the craft — all in one database save.
        [HttpPost("create")]
        public async Task<IActionResult> CreateOrder([FromBody] OrderCreateDto newOrderDto)
        {
            var scope = Scope;

            if (!scope.IsAdmin)
            {
                // Employees always craft in, and take materials from, their own warehouse.
                newOrderDto.BranchID = scope.BranchId ?? 0;
                newOrderDto.SourceBranchID = scope.BranchId;
            }

            if (scope.EmployeeId is int sessionEmployeeId)
            {
                newOrderDto.EmployeeID = sessionEmployeeId;
            }

            var sourceBranchId = newOrderDto.SourceBranchID ?? newOrderDto.BranchID;

            if (newOrderDto.Quantity < 1)
                return BadRequest("Quantity must be at least 1.");

            var item = await context.Items.FindAsync(newOrderDto.ItemID);
            if (item == null)
                return BadRequest($"Item with ID {newOrderDto.ItemID} does not exist.");

            if (await context.Branches.FindAsync(newOrderDto.BranchID) == null)
                return BadRequest($"Warehouse with ID {newOrderDto.BranchID} does not exist.");

            if (sourceBranchId != newOrderDto.BranchID && await context.Branches.FindAsync(sourceBranchId) == null)
                return BadRequest($"Warehouse with ID {sourceBranchId} does not exist.");

            if (await context.Employees.FindAsync(newOrderDto.EmployeeID) == null)
                return BadRequest($"Employee with ID {newOrderDto.EmployeeID} does not exist.");

            // Blueprint for this item
            var ingredients = await context.ItemIngredients
                .Where(ig => ig.ProductID == item.ItemID)
                .Include(ig => ig.IngredientItem)
                .ToListAsync();

            if (ingredients.Count == 0)
                return BadRequest($"{item.ItemName} has no blueprint, so it can't be crafted.");

            // Stock at the source warehouse
            var ingredientIds = ingredients.Select(ig => ig.IngredientID).ToList();
            var stockRows = await context.BranchItemCapacities
                .Where(bic => bic.BranchID == sourceBranchId && ingredientIds.Contains(bic.ItemID))
                .ToListAsync();

            var shortages = new List<string>();
            foreach (var ingredient in ingredients)
            {
                var needed = ingredient.IngredientQuantity * newOrderDto.Quantity;
                var have = stockRows.Where(r => r.ItemID == ingredient.IngredientID).Sum(r => r.ItemQuantity);
                if (have < needed)
                {
                    shortages.Add($"{ingredient.IngredientItem?.ItemName ?? $"Item {ingredient.IngredientID}"} (need {needed}, have {have})");
                }
            }

            if (shortages.Count > 0)
                return BadRequest($"Not enough materials: {string.Join(", ", shortages)}.");

            // Take the materials out of stock
            foreach (var ingredient in ingredients)
            {
                var remaining = ingredient.IngredientQuantity * newOrderDto.Quantity;
                foreach (var row in stockRows.Where(r => r.ItemID == ingredient.IngredientID))
                {
                    if (remaining <= 0) break;
                    var take = Math.Min(row.ItemQuantity, remaining);
                    row.ItemQuantity -= take;
                    remaining -= take;
                }
            }

            int activeOrderCount = await context.Orders
                .CountAsync(o => o.BranchID == newOrderDto.BranchID && o.Status == "Active");

            // Start straight away if the warehouse has a free production slot
            string initialStatus = activeOrderCount < MaxActivePerBranch ? "Active" : "Queued";

            var newOrder = new Order
            {
                ItemID = newOrderDto.ItemID,
                Quantity = newOrderDto.Quantity,
                BranchID = newOrderDto.BranchID,
                SourceBranchID = sourceBranchId,
                EmployeeID = newOrderDto.EmployeeID,
                OrderExpedite = newOrderDto.OrderExpedite,
                Status = initialStatus,
                CreatedDateTime = DateTime.UtcNow,
                StartedDateTime = initialStatus == "Active" ? DateTime.UtcNow : null,
                TotalTime = newOrderDto.Quantity * item.ProductionTime,
                TimeElapsed = 0
            };

            newOrder.OrderHistories.Add(new OrderHistory
            {
                PreviousStatus = "",
                NewStatus = initialStatus,
                ChangedDateTime = DateTime.UtcNow,
                ChangedByEmployeeID = newOrderDto.EmployeeID,
                ChangeReason = sourceBranchId == newOrderDto.BranchID
                    ? "Order created"
                    : $"Order created using materials from warehouse {sourceBranchId}"
            });

            context.Orders.Add(newOrder);
            await context.SaveChangesAsync();

            var created = await context.Orders
                .Include(o => o.Item)
                .Include(o => o.Branch)
                .FirstAsync(o => o.OrderID == newOrder.OrderID);

            return CreatedAtAction(nameof(GetOrderById), new { id = newOrder.OrderID }, ToDto(created));
        }

        #endregion

        #region UpdateRoutes

        // PUT /api/Order/{id} — only the expedite flag can change after an order is placed
        // (changing item/quantity would break the stock that was already taken out).
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOrder(int id, [FromBody] OrderCreateDto updatedOrderDto)
        {
            var existingOrder = await context.Orders
                .Include(o => o.Item)
                .Include(o => o.Branch)
                .FirstOrDefaultAsync(o => o.OrderID == id);

            if (existingOrder == null)
                return NotFound($"Order with ID {id} not found.");

            if (!Scope.CanAccess(existingOrder.BranchID))
                return Forbidden("You can only change orders from your own warehouse.");

            if (existingOrder.Status == "Complete" || existingOrder.Status == "Cancelled")
                return BadRequest($"Cannot update an order with status '{existingOrder.Status}'.");

            existingOrder.OrderExpedite = updatedOrderDto.OrderExpedite;
            await context.SaveChangesAsync();

            return Ok(ToDto(existingOrder));
        }

        // PUT /api/Order/{id}/status — pause, resume, cancel, ...
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] OrderStatusUpdateDto statusDto)
        {
            var scope = Scope;
            var order = await context.Orders.FindAsync(id);
            if (order == null)
                return NotFound($"Order with ID {id} not found.");

            if (!scope.CanAccess(order.BranchID))
                return Forbidden("You can only change orders from your own warehouse.");

            var validStatuses = new[] { "Queued", "Active", "Paused", "Cancelled", "Complete" };
            if (!validStatuses.Contains(statusDto.Status))
                return BadRequest($"Invalid status '{statusDto.Status}'. Valid statuses are: Queued, Active, Paused, Cancelled, Complete.");

            string previousStatus = order.Status;

            if (previousStatus == "Complete" || previousStatus == "Cancelled")
                return BadRequest($"Cannot transition from '{previousStatus}' status.");

            if (statusDto.Status == "Active" && previousStatus != "Active")
            {
                int activeOrderCount = await context.Orders
                    .CountAsync(o => o.BranchID == order.BranchID && o.Status == "Active");

                if (activeOrderCount >= MaxActivePerBranch)
                    return BadRequest($"This warehouse already has {MaxActivePerBranch} active orders. Pause one first.");

                order.StartedDateTime ??= DateTime.UtcNow;
            }

            if (statusDto.Status == "Complete")
            {
                order.CompletedDateTime = DateTime.UtcNow;
            }

            if (statusDto.Status == "Cancelled")
            {
                await RefundMaterialsAsync(order);
            }

            order.Status = statusDto.Status;

            context.OrderHistories.Add(new OrderHistory
            {
                OrderID = id,
                PreviousStatus = previousStatus,
                NewStatus = statusDto.Status,
                ChangedDateTime = DateTime.UtcNow,
                ChangedByEmployeeID = statusDto.ChangedByEmployeeID ?? scope.EmployeeId,
                ChangeReason = statusDto.Status == "Cancelled"
                    ? (statusDto.ChangeReason ?? "Cancelled — materials returned to stock")
                    : statusDto.ChangeReason
            });

            await context.SaveChangesAsync();

            return Ok(new { message = "Order status updated successfully." });
        }

        /// <summary>Puts a cancelled order's materials back into the warehouse they came from.</summary>
        async Task RefundMaterialsAsync(Order order)
        {
            var sourceBranchId = order.SourceBranchID ?? order.BranchID;
            var ingredients = await context.ItemIngredients
                .Where(ig => ig.ProductID == order.ItemID)
                .ToListAsync();

            foreach (var ingredient in ingredients)
            {
                var amount = ingredient.IngredientQuantity * order.Quantity;
                var row = await context.BranchItemCapacities
                    .FirstOrDefaultAsync(bic => bic.BranchID == sourceBranchId && bic.ItemID == ingredient.IngredientID);

                if (row == null)
                {
                    context.BranchItemCapacities.Add(new BranchItemCapacity
                    {
                        BranchID = sourceBranchId,
                        ItemID = ingredient.IngredientID,
                        ItemQuantity = amount
                    });
                }
                else
                {
                    row.ItemQuantity += amount;
                }
            }
        }

        #endregion

        #region DeleteRoutes

        // DELETE /api/Order/{id} — removes an unfinished order and returns its materials
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteOrder(int id)
        {
            var order = await context.Orders.FindAsync(id);

            if (order == null)
                return NotFound($"Order with ID {id} not found.");

            if (!Scope.CanAccess(order.BranchID))
                return Forbidden("You can only delete orders from your own warehouse.");

            if (order.Status == "Complete" || order.Status == "Cancelled")
                return BadRequest($"Cannot delete an order with status '{order.Status}'.");

            if (OpenStatuses.Contains(order.Status))
            {
                await RefundMaterialsAsync(order);
            }

            context.Orders.Remove(order);
            await context.SaveChangesAsync();

            return NoContent();
        }

        #endregion
    }
}
