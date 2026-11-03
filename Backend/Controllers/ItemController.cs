using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Artifax.Models;
using Artifax.Data;
using Artifax.DTOs;
using Artifax.Helpers;

namespace Artifax.Controllers
{
    [ApiController]
    [Route("api/[Controller]")]
    public class ItemController : ControllerBase
    {
        private readonly ArtifaxContext _context;
        public ItemController(ArtifaxContext context)
        {
            _context = context;
        }

        BranchScope Scope => BranchScope.From(HttpContext);

        static ObjectResult Forbidden(string message) => new ObjectResult(message) { StatusCode = StatusCodes.Status403Forbidden };

        #region ItemEndpoints

        //List of all items
        [HttpGet("item/")]
        public async Task<ActionResult<IEnumerable<ItemReadDto>>> GetAllItems()
        {
            return await _context.Items.Select(i => ItemReadDto.ToDto(i)).ToListAsync();
        }
        [HttpGet("item/{id}")]
        public async Task<ActionResult<ItemReadDto>> GetItem(int id)
        {
            var _item = await _context.Items.FindAsync(id);
            if (_item == null)
            {
                return NotFound();
            }
            return ItemReadDto.ToDto(_item);
        }


        [HttpPost("item/")]
        public async Task<ActionResult<Item>> CreateItem(ItemWriteDto incoming)
        {
            Item _item = new Item()
            {
                ItemCategory = incoming.ItemCategory,
                ItemName = incoming.ItemName,
                ProductionTime = incoming.ProductionTime,
                Price = incoming.Price
            };
            _context.Items.Add(_item);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetItem), new { id = _item.ItemID }, new ItemReadDto()
            {
                ItemID = _item.ItemID,
                ItemName = _item.ItemName,
                ItemCategory = _item.ItemCategory,
                ProductionTime = _item.ProductionTime,
                Price = _item.Price
            });
        }
        [HttpPost("item/CreateItemDefaultQuantity")]
        public async Task<ActionResult<Item>> CreateItemAndBranches(ItemWriteDto incoming)
        {
            Item _item = new Item()
            {
                ItemCategory = incoming.ItemCategory,
                ItemName = incoming.ItemName,
                ProductionTime = incoming.ProductionTime,
                Price = incoming.Price
            };
            _context.Items.Add(_item);
            await _context.SaveChangesAsync();
            var branches = await _context.Branches.ToListAsync();
            foreach (var branch in branches)
            {
                var defaultCapacity = new BranchItemCapacity()
                {
                    BranchID = branch.BranchID,
                    ItemID = _item.ItemID,
                    ItemQuantity = 0
                };
                _context.BranchItemCapacities.Add(defaultCapacity);
            }
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetItem), new { id = _item.ItemID }, new ItemReadDto()
            {
                ItemID = _item.ItemID,
                ItemName = _item.ItemName,
                ItemCategory = _item.ItemCategory,
                ProductionTime = _item.ProductionTime,
                Price = _item.Price
            });
        }
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateItem(int id, ItemWriteDto incoming)
        {
            var _item = await _context.Items.FindAsync(id);
            if (_item == null)
            {
                return NotFound();
            }
            _item.ItemName = incoming.ItemName;
            _item.ItemCategory = incoming.ItemCategory;
            _item.ProductionTime = incoming.ProductionTime;
            _item.Price = incoming.Price;
            await _context.SaveChangesAsync();
            return NoContent();
        }
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            var _item = await _context.Items.FindAsync(id);
            if (_item == null)
            {
                return NotFound();
            }
            _context.Items.Remove(_item);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        #endregion
        #region BlueprintEndpoints
        [HttpGet("item/allItemBlueprints")]
        public async Task<ActionResult<IEnumerable<ItemBlueprintReadDto>>> GetAllItemsWithIngredients()
        {
            var itemsWithIngredients = await _context.ItemIngredients
                .Join(_context.Items, ig => ig.ProductID, i => i.ItemID, (ig, i) => new { Item = i, Ingredient = ig })
                .GroupBy(x => x.Item)
                .Select(g => new ItemBlueprintReadDto
                {
                    ItemID = g.Key.ItemID,
                    ItemName = g.Key.ItemName,
                    ItemCategory = g.Key.ItemCategory,
                    ProductionTime = g.Key.ProductionTime,
                    Price = g.Key.Price,
                    Ingredients = g.Select(x => new IngredientBlueprintReadDto
                    {
                        IngredientID = x.Ingredient.IngredientID,
                        ItemName = x.Ingredient.IngredientItem.ItemName,
                        ItemCategory = x.Ingredient.IngredientItem.ItemCategory,
                        Quantity = x.Ingredient.IngredientQuantity
                    }).ToList()
                }).ToListAsync();

            return itemsWithIngredients;
        }
        [HttpGet("item/allInventoryItems")]
        public async Task<ActionResult<IEnumerable<InventoryItemReadDto>>> GetAllInventoryItems()
        {
            var scope = Scope;
            var capacities = _context.BranchItemCapacities.AsQueryable();
            if (scope.BranchId is int branchId)
            {
                capacities = capacities.Where(c => c.BranchID == branchId);
            }

            var inventoryItems = await capacities
                .Join(_context.Items, c => c.ItemID, i => i.ItemID, (c, i) => new { Capacity = c, Item = i })
                .Join(_context.Branches, x => x.Capacity.BranchID, b => b.BranchID, (x, b) => new { x.Capacity, x.Item, Branch = b })
                .Select(x => new InventoryItemReadDto(x.Item, x.Branch, x.Capacity))
                .ToListAsync();
            return inventoryItems;
        }


        //Updates the items prod time and creates new ingredients for the blueprint
        [HttpPut("item/{itemId}/blueprint")]
        public async Task<ActionResult> UpdateItemBlueprint(int itemId, ItemBlueprintWriteDto incoming)
        {
            var item = await _context.Items.FindAsync(itemId);
            if (item == null)
            {
                return NotFound();
            }
            item.ProductionTime = incoming.ProductionTime;
            item.Price = incoming.Price;
            if (incoming.Ingredients != null)
            {
                foreach (var ig in incoming.Ingredients)
                {
                    var itemIngredient = new ItemIngredient
                    {
                        ProductID = itemId,
                        IngredientID = ig.IngredientID,
                        IngredientQuantity = ig.IngredientQuantity
                    };
                    _context.ItemIngredients.Add(itemIngredient);
                }
            }
            await _context.SaveChangesAsync();
            return NoContent();
        }

        //Updates prod time for item and updates existing ingredients, including creating new ones and deleting old ones
        [HttpPut("item/{itemId}/blueprint/edit")]
        public async Task<ActionResult> EditItemBlueprint(int itemId, ItemBlueprintWriteDto incoming)
        {
            var item = await _context.Items
                .Include(i => i.ProductItemIngredients)
                .FirstOrDefaultAsync(i => i.ItemID == itemId);
            if (item == null)
            {
                return NotFound();
            }
            item.ProductionTime = incoming.ProductionTime;
            item.Price = incoming.Price;
            if (incoming.Ingredients != null)
            {
                var incomingIngredientIds = incoming.Ingredients.Select(i => i.IngredientID).ToList();
                var ingredientsToRemove = item.ProductItemIngredients
                    .Where(existing => !incomingIngredientIds.Contains(existing.IngredientID))
                    .ToList();
                foreach (var igToRemove in ingredientsToRemove)
                {
                    _context.ItemIngredients.Remove(igToRemove);
                }
                foreach (var incomingIg in incoming.Ingredients)
                {
                    var existingIg = item.ProductItemIngredients
                        .FirstOrDefault(e => e.IngredientID == incomingIg.IngredientID);
                    if (existingIg != null)
                    {
                        existingIg.IngredientQuantity = incomingIg.IngredientQuantity;
                    }
                    else
                    {
                        var newIngredient = new ItemIngredient
                        {
                            ProductID = itemId,
                            IngredientID = incomingIg.IngredientID,
                            IngredientQuantity = incomingIg.IngredientQuantity
                        };
                        _context.ItemIngredients.Add(newIngredient);
                    }
                }
            }
            await _context.SaveChangesAsync();
            return NoContent();
        }
        #endregion

        #region ItemRecipeEndpoints
        //All item ingredients
        [HttpGet("itemIngredient/")]
        public async Task<ActionResult<IEnumerable<ItemIngredientReadDto>>> GetAllItemIngredients()
        {
            return await _context.ItemIngredients.Select(ig => ItemIngredientReadDto.ToDto(ig)).ToListAsync();
        }

        // Get a specific item ingredient by ID
        [HttpGet("itemIngredient/{id}")]
        public async Task<ActionResult<ItemIngredientReadDto>> GetItemIngredient(int id)
        {
            var _itemIngredient = await _context.ItemIngredients.FindAsync(id);
            if (_itemIngredient == null)
            {
                return NotFound();
            }
            return ItemIngredientReadDto.ToDto(_itemIngredient);
        }
        [HttpGet("itemIngredient/item/{itemId}")]
        public async Task<ActionResult<IEnumerable<IngredientBlueprintReadDto>>> GetIngredientsForItem(int itemId)
        {
            var blueprint = await (from ingredient in _context.ItemIngredients
                                   join item in _context.Items on ingredient.IngredientID equals item.ItemID
                                   where ingredient.ProductID == itemId
                                   select new IngredientBlueprintReadDto
                                   {
                                       IngredientID = item.ItemID,
                                       ItemName = item.ItemName,
                                       ItemCategory = item.ItemCategory,
                                       ItemPrice = item.Price,
                                       Quantity = ingredient.IngredientQuantity
                                   }).ToListAsync();
            // Raw materials simply have no ingredients: return an empty list instead of a 404
            return blueprint;
        }

        // Create a new item ingredient
        [HttpPost("itemIngredient/")]
        public async Task<ActionResult<ItemIngredient>> CreateItemIngredient(ItemIngredientWriteDto incoming)
        {
            ItemIngredient _itemIngredient = new ItemIngredient()
            {
                IngredientID = incoming.IngredientID,
                IngredientQuantity = incoming.IngredientQuantity,
                ProductID = incoming.ProductID
            };

            _context.ItemIngredients.Add(_itemIngredient);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetItemIngredient), new { id = _itemIngredient.ItemIngredientID }, new ItemIngredientReadDto()
            {
                ItemIngredientID = _itemIngredient.ItemIngredientID,
                IngredientID = _itemIngredient.IngredientID,
                IngredientQuantity = _itemIngredient.IngredientQuantity,
                ProductID = _itemIngredient.ProductID
            });
        }

        // Update an existing item ingredient
        [HttpPut("itemIngredient/{id}")]
        public async Task<IActionResult> UpdateItemIngredient(int id, ItemIngredientWriteDto incoming)
        {
            var _itemIngredient = await _context.ItemIngredients.FindAsync(id);
            if (_itemIngredient == null)
            {
                return NotFound();
            }

            _itemIngredient.IngredientID = incoming.IngredientID;
            _itemIngredient.IngredientQuantity = incoming.IngredientQuantity;
            _itemIngredient.ProductID = incoming.ProductID;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Delete an item ingredient
        [HttpDelete("itemIngredient/{id}")]
        public async Task<IActionResult> DeleteItemIngredient(int id)
        {
            var _itemIngredient = await _context.ItemIngredients.FindAsync(id);
            if (_itemIngredient == null)
            {
                return NotFound();
            }

            _context.ItemIngredients.Remove(_itemIngredient);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        #endregion

        #region BranchItemEndpoints
        [HttpGet("Branch")]
        public async Task<ActionResult<IEnumerable<BranchItemCapacityReadDto>>> GetAllBranchItems()
        {
            var scope = Scope;
            var capacities = _context.BranchItemCapacities.AsQueryable();
            if (scope.BranchId is int branchId)
            {
                capacities = capacities.Where(c => c.BranchID == branchId);
            }
            return await capacities.Select(bic => BranchItemCapacityReadDto.ToDto(bic)).ToListAsync();
        }
        [HttpGet("Branch/{branchID}")]
        public async Task<ActionResult<IEnumerable<BranchItemCapacityReadDto>>> GetItemsByBranch(int branchID)
        {
            if (!Scope.CanAccess(branchID)) return Forbidden("You can only view stock in your own warehouse.");
            return await _context.BranchItemCapacities.Where(bic => bic.BranchID == branchID).Select(bic => BranchItemCapacityReadDto.ToDto(bic)).ToListAsync();
        }
        [HttpGet("Branch/GetItemCapacity/{id}")]
        public async Task<ActionResult<BranchItemCapacityReadDto>> GetBranchItemsByID(int id)
        {
            var _branchItemCapacity = await _context.BranchItemCapacities.FindAsync(id);
            if (_branchItemCapacity == null)
            {
                return NotFound();
            }
            return BranchItemCapacityReadDto.ToDto(_branchItemCapacity);
        }
        [HttpPost("Branch")]
        public async Task<ActionResult<BranchItemCapacity>> CreateBranchItems(BranchItemCapacityWriteDto incoming)
        {
            if (!Scope.CanAccess(incoming.BranchID)) return Forbidden("You can only change stock in your own warehouse.");
            BranchItemCapacity _branchItemCapacity = new BranchItemCapacity()
            {
                BranchID = incoming.BranchID,
                ItemID = incoming.ItemID,
                ItemQuantity = incoming.ItemQuantity
            };
            _context.BranchItemCapacities.Add(_branchItemCapacity);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetBranchItemsByID), new { id = _branchItemCapacity.BranchItemCapacityID }, new BranchItemCapacityReadDto()
            {
                BranchItemCapacityID = _branchItemCapacity.BranchItemCapacityID,
                BranchID = _branchItemCapacity.BranchID,
                ItemID = _branchItemCapacity.ItemID,
                ItemQuantity = _branchItemCapacity.ItemQuantity
            });
        }
        [HttpPut("Branch/{id}")]
        public async Task<IActionResult> UpdateBranchItemCapacity(int id, BranchItemCapacityWriteDto incoming)
        {
            var _branchItemCapacity = await _context.BranchItemCapacities.FindAsync(id);
            if (_branchItemCapacity == null)
            {
                return NotFound();
            }
            if (!Scope.CanAccess(_branchItemCapacity.BranchID) || !Scope.CanAccess(incoming.BranchID))
            {
                return Forbidden("You can only change stock in your own warehouse.");
            }
            _branchItemCapacity.BranchID = incoming.BranchID;
            _branchItemCapacity.ItemID = incoming.ItemID;
            _branchItemCapacity.ItemQuantity = incoming.ItemQuantity;
            await _context.SaveChangesAsync();
            return NoContent();
        }
        [HttpPut("Branch/{id}/UpdateQuantity")]
        public async Task<IActionResult> UpdateBranchItemCapacityQuantity(int id, BranchItemCapacityWriteDto incoming)
        {
            var _branchItemCapacity = await _context.BranchItemCapacities.FindAsync(id);
            if (_branchItemCapacity == null)
            {
                return NotFound();
            }
            if (!Scope.CanAccess(_branchItemCapacity.BranchID))
            {
                return Forbidden("You can only change stock in your own warehouse.");
            }
            _branchItemCapacity.ItemQuantity = incoming.ItemQuantity;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("Branch/{id}")]
        public async Task<IActionResult> DeleteBranchItemCapacity(int id)
        {
            var _branchItemCapacity = await _context.BranchItemCapacities.FindAsync(id);
            if (_branchItemCapacity == null)
            {
                return NotFound();
            }
            if (!Scope.CanAccess(_branchItemCapacity.BranchID))
            {
                return Forbidden("You can only change stock in your own warehouse.");
            }

            _context.BranchItemCapacities.Remove(_branchItemCapacity);
            await _context.SaveChangesAsync();
            return NoContent();
        }
        // Sets the exact stock level of an item in a warehouse (creates the stock row if missing).
        [HttpPut("Branch/{branchId}/Item/{itemId}")]
        public async Task<IActionResult> UpdateBICQuantity(int branchId, int itemId, [FromQuery] int quantity)
        {
            if (!Scope.CanAccess(branchId)) return Forbidden("You can only change stock in your own warehouse.");
            if (quantity < 0) return BadRequest("Quantity cannot be negative.");

            var branchItemCapacity = await _context.BranchItemCapacities
                .FirstOrDefaultAsync(bic => bic.BranchID == branchId && bic.ItemID == itemId);
            if (branchItemCapacity == null)
            {
                if (await _context.Items.FindAsync(itemId) == null || await _context.Branches.FindAsync(branchId) == null)
                {
                    return NotFound($"No item {itemId} or warehouse {branchId}.");
                }
                _context.BranchItemCapacities.Add(new BranchItemCapacity { BranchID = branchId, ItemID = itemId, ItemQuantity = quantity });
            }
            else
            {
                branchItemCapacity.ItemQuantity = quantity;
            }
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Adds stock for one or more materials in a warehouse in one go (the "Restock materials" screen).
        // Body: [{ "itemID": 1, "quantity": 50 }, ...]
        [HttpPost("Branch/{branchId}/restock")]
        public async Task<ActionResult<IEnumerable<BranchItemCapacityReadDto>>> RestockBranch(int branchId, [FromBody] List<RestockLineDto> lines)
        {
            if (!Scope.CanAccess(branchId)) return Forbidden("You can only restock your own warehouse.");
            if (await _context.Branches.FindAsync(branchId) == null) return NotFound($"Warehouse {branchId} does not exist.");
            if (lines == null || lines.Count == 0) return BadRequest("Add at least one material.");
            if (lines.Any(line => line.Quantity <= 0)) return BadRequest("Restock amounts must be more than 0.");
            if (lines.Any(line => line.Quantity > 100000)) return BadRequest("Restock amount is too large.");

            var itemIds = lines.Select(line => line.ItemID).Distinct().ToList();
            var knownItemIds = await _context.Items.Where(i => itemIds.Contains(i.ItemID)).Select(i => i.ItemID).ToListAsync();
            var unknown = itemIds.Except(knownItemIds).ToList();
            if (unknown.Count > 0) return BadRequest($"Unknown item(s): {string.Join(", ", unknown)}.");

            var rows = await _context.BranchItemCapacities
                .Where(bic => bic.BranchID == branchId && itemIds.Contains(bic.ItemID))
                .ToListAsync();

            foreach (var line in lines)
            {
                var row = rows.FirstOrDefault(r => r.ItemID == line.ItemID);
                if (row == null)
                {
                    row = new BranchItemCapacity { BranchID = branchId, ItemID = line.ItemID, ItemQuantity = 0 };
                    _context.BranchItemCapacities.Add(row);
                    rows.Add(row);
                }
                row.ItemQuantity += line.Quantity;
            }

            await _context.SaveChangesAsync();
            return Ok(rows.Select(BranchItemCapacityReadDto.ToDto).ToList());
        }


        #endregion
    }
}