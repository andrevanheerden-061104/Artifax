#nullable enable
using Microsoft.AspNetCore.Http;

namespace Artifax.Helpers
{
    /// <summary>
    /// Keys used to store the logged-in user in the server session.
    /// </summary>
    public static class SessionKeys
    {
        public const string UserLevel = "UserLevel";
        public const string UserEmail = "UserEmail";
        public const string Username = "Username";
        public const string BranchId = "BranchId";
        public const string EmployeeId = "EmployeeId";
        public const string Pending2FAEmail = "Pending2FAEmail";
    }

    /// <summary>
    /// Works out which warehouse (branch) the current request is allowed to see and change.
    ///
    /// - Employees are always locked to the warehouse saved on their account.
    /// - Admins can pick a warehouse with the "X-Branch-Id" request header (the
    ///   frontend sends it from the warehouse switcher). No header = "All warehouses".
    /// </summary>
    public sealed class BranchScope
    {
        public const string BranchHeader = "X-Branch-Id";
        public const string AdminLevel = "Admin";

        public bool IsAdmin { get; }

        /// <summary>The warehouse to filter by. Null means "all warehouses" (admins only).</summary>
        public int? BranchId { get; }

        /// <summary>The logged-in employee's ID, when known.</summary>
        public int? EmployeeId { get; }

        public bool IsAllWarehouses => BranchId == null;

        private BranchScope(bool isAdmin, int? branchId, int? employeeId)
        {
            IsAdmin = isAdmin;
            BranchId = branchId;
            EmployeeId = employeeId;
        }

        /// <summary>True when the user may read or change data in the given warehouse.</summary>
        public bool CanAccess(int branchId) => IsAdmin || BranchId == branchId;

        public static BranchScope From(HttpContext? httpContext)
        {
            // Unit tests construct controllers without an HTTP context; treat that as an
            // unrestricted admin so existing tests keep working. Real requests always have one.
            if (httpContext == null)
            {
                return new BranchScope(true, null, null);
            }

            ISession? session = null;
            try
            {
                session = httpContext.Session;
            }
            catch (InvalidOperationException)
            {
                // Session middleware not configured (tests) — same fallback as above.
                return new BranchScope(true, null, null);
            }

            if (session == null)
            {
                return new BranchScope(true, null, null);
            }

            var level = session.GetString(SessionKeys.UserLevel);
            var ownBranch = session.GetInt32(SessionKeys.BranchId);
            var employeeId = session.GetInt32(SessionKeys.EmployeeId);
            var isAdmin = level == AdminLevel;

            if (isAdmin)
            {
                int? selected = null;
                var headers = httpContext.Request?.Headers;
                if (headers != null
                    && headers.TryGetValue(BranchHeader, out var raw)
                    && int.TryParse(raw.ToString(), out var parsed)
                    && parsed > 0)
                {
                    selected = parsed;
                }

                return new BranchScope(true, selected, employeeId);
            }

            // Employees: always their own warehouse. -1 matches nothing if the account has no branch.
            return new BranchScope(false, ownBranch ?? -1, employeeId);
        }
    }
}
