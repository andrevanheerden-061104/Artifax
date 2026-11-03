using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Artifax.DTOs;
using Artifax.Models;
using Artifax.Data;
using Artifax.Helpers;
using Artifax.Services;
using Microsoft.EntityFrameworkCore;

namespace Artifax.Controllers
{
    [ApiController]
    [Route("api/[Controller]")]
    public class UserController : ControllerBase
    {
        internal enum EmployeeLevels
        {
            Employee,
            Admin
        }

        readonly ArtifaxContext context;
        readonly SupabaseOtpService otpService;

        // Used by unit tests.
        public UserController(ArtifaxContext incoming)
        {
            context = incoming;
        }

        [ActivatorUtilitiesConstructor]
        public UserController(ArtifaxContext incoming, SupabaseOtpService otp)
        {
            context = incoming;
            otpService = otp;
        }

        bool isAdmin => HttpContext.Session.GetString(SessionKeys.UserLevel) == EmployeeLevels.Admin.ToString();

        /// <summary>
        /// Accounts that skip the emailed code (e.g. the portfolio demo login).
        /// Set TWO_FACTOR_BYPASS_EMAILS to a comma-separated list. Defaults to the two demo accounts.
        /// </summary>
        static bool BypassesTwoFactor(string email)
        {
            var raw = Environment.GetEnvironmentVariable("TWO_FACTOR_BYPASS_EMAILS") ?? "demo@artifax.app,cpt@artifax.app";
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(entry => string.Equals(entry, email, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Stores the employee in the session = they are now logged in.</summary>
        async Task<CurrentUserDto> CompleteLoginAsync(Employee employee)
        {
            HttpContext.Session.Remove(SessionKeys.Pending2FAEmail);
            HttpContext.Session.SetString(SessionKeys.UserLevel, employee.EmployeeLevel ?? EmployeeLevels.Employee.ToString());
            HttpContext.Session.SetString(SessionKeys.UserEmail, employee.EmployeeEmail ?? "");
            HttpContext.Session.SetString(SessionKeys.Username, employee.EmployeeName ?? "");
            HttpContext.Session.SetInt32(SessionKeys.BranchId, employee.BranchId);
            HttpContext.Session.SetInt32(SessionKeys.EmployeeId, employee.EmployeeId);
            return await BuildCurrentUserAsync();
        }

        async Task<CurrentUserDto> BuildCurrentUserAsync()
        {
            var branchId = HttpContext.Session.GetInt32(SessionKeys.BranchId);
            string branchName = null;
            if (branchId != null)
            {
                branchName = (await context.Branches.FindAsync(branchId.Value))?.BranchName;
            }

            return new CurrentUserDto
            {
                UserLevel = HttpContext.Session.GetString(SessionKeys.UserLevel),
                UserEmail = HttpContext.Session.GetString(SessionKeys.UserEmail),
                Username = HttpContext.Session.GetString(SessionKeys.Username),
                EmployeeId = HttpContext.Session.GetInt32(SessionKeys.EmployeeId),
                BranchId = branchId,
                BranchName = branchName
            };
        }

        #region GetRoutes
        //Get All Employees
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllUsers()
        {
            return await context.Employees.Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync();
        }

        [HttpGet("employees")]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllEmployees()
        {
            return await context.Employees.Where(employee => employee.EmployeeLevel == EmployeeLevels.Employee.ToString()).Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync();
        }

        [HttpGet("admins")]
        public async Task<ActionResult<IEnumerable<EmployeeReadDto>>> GetAllAdmins()
        {
            return await context.Employees.Where(employee => employee.EmployeeLevel == EmployeeLevels.Admin.ToString()).Select(employee => EmployeeReadDto.ToDto(employee)).ToListAsync();
        }

        //Get All Employee by Id
        [HttpGet("employee/{email}")]
        public async Task<ActionResult<EmployeeReadDto>> GetEmployeeByEmail(string email)
        {
            var _result = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == email);
            if (_result == null) return NotFound();
            return EmployeeReadDto.ToDto(_result);
        }


        [AllowAnonymous]
        [HttpGet("me")]
        public async Task<IActionResult> GetCurrentUser()
        {
            var _userLevel = HttpContext.Session.GetString(SessionKeys.UserLevel);

            if (string.IsNullOrEmpty(_userLevel))
            {
                // No session = logged out. 401 tells the frontend to go to the login screen.
                return Unauthorized("No active session.");
            }

            return Ok(await BuildCurrentUserAsync());
        }
        #endregion


        #region PostRoutes

        // summary
        // Registers a new employee in the system and hashes their password.

        [HttpPost("employee")]
        public async Task<ActionResult<EmployeeReadDto>> CreateEmployee(EmployeeWriteDto incoming)
        {
            //Authentication Test
            if (!isAdmin)
            {
                return Unauthorized("Creation attempted by non-admin!");
            }

            //Check whether employee with incoming details already exists to prevent duplicate emails for login
            bool _employeeFound = await context.Employees.FirstOrDefaultAsync(_employee => _employee.EmployeeEmail == incoming.EmployeeEmail) != null;
            if (_employeeFound) return Unauthorized("Email Already Exists");

            //Creates new employee from incoming details
            Employee _employee = new()
            {
                BranchId = incoming.BranchID,
                EmployeeEmail = incoming.EmployeeEmail,
                EmployeeName = incoming.EmployeeName,
                EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(incoming.EmployeePassword),
                EmployeeLevel = incoming.EmployeeLevel
            };

            //Save new employee to database
            context.Employees.Add(_employee);
            await context.SaveChangesAsync();

            //Convert new employee to Read DTO using static function in EmployeeReadDto class
            EmployeeReadDto _dto = EmployeeReadDto.ToDto(_employee);

            return CreatedAtAction(nameof(GetEmployeeByEmail), new { email = _employee.EmployeeEmail }, _dto);
        }

        // Step 1 of login: check email + password. If correct, email a 6-digit code via Supabase.
        [AllowAnonymous]
        [HttpPost("employees/login")]
        public async Task<IActionResult> LoginEmployee(LoginDto incoming)
        {
            var email = (incoming.Email ?? "").Trim();
            var _employee = await context.Employees
                .FirstOrDefaultAsync(employee => employee.EmployeeEmail.ToLower() == email.ToLower());

            // Same message for unknown email and wrong password, so attackers can't probe for accounts.
            if (_employee == null || string.IsNullOrEmpty(_employee.EmployeePasswordHash)
                || !BCrypt.Net.BCrypt.Verify(incoming.Password ?? "", _employee.EmployeePasswordHash))
            {
                return Unauthorized("Incorrect email or password.");
            }

            if (BypassesTwoFactor(_employee.EmployeeEmail))
            {
                var user = await CompleteLoginAsync(_employee);
                return Ok(new { requires2FA = false, user });
            }

            if (otpService == null)
            {
                return StatusCode(503, "Email verification is not available.");
            }

            var (sent, error) = await otpService.SendCodeAsync(_employee.EmployeeEmail, HttpContext.RequestAborted);
            if (!sent)
            {
                return StatusCode(503, error);
            }

            HttpContext.Session.SetString(SessionKeys.Pending2FAEmail, _employee.EmployeeEmail);
            return Ok(new { requires2FA = true, email = MaskEmail(_employee.EmployeeEmail) });
        }

        // Sends a fresh code to the email waiting for verification.
        [AllowAnonymous]
        [HttpPost("employees/resend-code")]
        public async Task<IActionResult> ResendCode()
        {
            var pendingEmail = HttpContext.Session.GetString(SessionKeys.Pending2FAEmail);
            if (string.IsNullOrEmpty(pendingEmail)) return Unauthorized("Session expired. Please log in again.");
            if (otpService == null) return StatusCode(503, "Email verification is not available.");

            var (sent, error) = await otpService.SendCodeAsync(pendingEmail, HttpContext.RequestAborted);
            if (!sent) return StatusCode(503, error);

            return Ok(new { email = MaskEmail(pendingEmail) });
        }

        [AllowAnonymous]
        [HttpPost("logout")]
        public IActionResult LogOutUser()
        {
            HttpContext.Session.Clear();

            Response.Cookies.Delete(".AspNetCore.Session");

            return NoContent();
        }

        // Step 2 of login: check the emailed code with Supabase, then start the session.
        [AllowAnonymous]
        [HttpPost("employees/verify-2fa")]
        public async Task<IActionResult> Verify2Fa([FromBody] Dictionary<string, string> body)
        {
            if (body == null || !body.TryGetValue("code", out var code) || string.IsNullOrWhiteSpace(code))
            {
                return BadRequest("Code is required");
            }

            var pendingEmail = HttpContext.Session.GetString(SessionKeys.Pending2FAEmail);
            if (string.IsNullOrEmpty(pendingEmail)) return Unauthorized("Session expired. Please log in again.");
            if (otpService == null) return StatusCode(503, "Email verification is not available.");

            var verifiedEmail = await otpService.VerifyCodeAsync(pendingEmail, code.Trim(), HttpContext.RequestAborted);
            if (verifiedEmail == null || !string.Equals(verifiedEmail, pendingEmail, StringComparison.OrdinalIgnoreCase))
            {
                return Unauthorized("Invalid or expired verification code.");
            }

            var _employee = await context.Employees
                .FirstOrDefaultAsync(e => e.EmployeeEmail.ToLower() == pendingEmail.ToLower());
            if (_employee == null) return Unauthorized();

            var user = await CompleteLoginAsync(_employee);
            return Ok(user);
        }

        static string MaskEmail(string email)
        {
            var at = email.IndexOf('@');
            if (at <= 1) return email;
            return $"{email[0]}{new string('•', Math.Min(at - 1, 6))}{email[at..]}";
        }

        #endregion


        #region UpdateRoutes

        // summary
        // Updates the assigned branch for an existing employee.

        [HttpPatch("employee/branch")]
        public async Task<ActionResult<EmployeeReadDto>> ChangeEmployeeBranch(string EmployeeEmail, int BranchId)
        {
            //Authentication Check
            if (!isAdmin)
            {
                return Unauthorized("Update attempted by non-admin!");
            }

            //Check for existing employee
            var _employee = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == EmployeeEmail);

            if (_employee == null) return NotFound($"Employee with Email: [{EmployeeEmail}] could not be found");

            //Check for existing branch
            bool _branchExists = await context.Branches.FindAsync(BranchId) != null;

            if (!_branchExists) return NotFound($"Branch with ID: [{BranchId.ToString()}] could not be found");

            //Update information
            _employee.BranchId = BranchId;
            await context.SaveChangesAsync();
            return Ok(EmployeeReadDto.ToDto(_employee));
        }


        // summary
        // Updates the profile information of an existing employee.

        [HttpPatch("employee")]
        public async Task<ActionResult<EmployeeReadDto>> ChangeEmployeeDetails(string EmployeeEmail, EmployeeWriteDto incoming)
        {
            //Check for existing employee
            var _employee = await context.Employees.FirstOrDefaultAsync(employee => employee.EmployeeEmail == EmployeeEmail);

            if (_employee == null) return NotFound($"Employee with email: [{EmployeeEmail}] could not be found");

            if (!isAdmin)
            {
                return Unauthorized("Update attempted by user with incorrect credentials!");
            }

            //Update details
            _employee.EmployeeEmail = incoming.EmployeeEmail;
            _employee.EmployeeName = incoming.EmployeeName;
            // Only update password hash when a new password is provided
            if (!string.IsNullOrWhiteSpace(incoming.EmployeePassword))
            {
                _employee.EmployeePasswordHash = BCrypt.Net.BCrypt.HashPassword(incoming.EmployeePassword);
            }

            //Save changes
            await context.SaveChangesAsync();
            return Ok(EmployeeReadDto.ToDto(_employee));
        }

        #endregion

        #region DeleteRoutes
        // Permanently removes an employee from the system.

        [HttpDelete("employee")]
        public async Task<IActionResult> DeleteEmployee(int id)
        {
            //Authentication Check
            if (!isAdmin)
            {
                return Unauthorized("Delete attempted by non-admin!");
            }
            //Check for existing admin
            var _employee = await context.Employees.FindAsync(id);
            if (_employee == null) return NotFound($"Employee with ID: {id.ToString()} could not be found");
            //Remove admin from list
            context.Employees.Remove(_employee);
            //Save changes
            await context.SaveChangesAsync();
            return NoContent();
        }
        #endregion
    }
}