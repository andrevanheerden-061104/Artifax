using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Artifax.Helpers
{
    /// <summary>
    /// Global filter: every API call needs a logged-in session, except actions marked
    /// [AllowAnonymous] (login, 2FA verification, logout, "who am I").
    /// Without this, anyone who found the Render URL could read or change the data.
    /// </summary>
    public class RequireSessionFilter : IActionFilter
    {
        public void OnActionExecuting(ActionExecutingContext context)
        {
            var allowsAnonymous = context.ActionDescriptor.EndpointMetadata
                .OfType<IAllowAnonymous>()
                .Any();

            if (allowsAnonymous)
            {
                return;
            }

            var level = context.HttpContext.Session.GetString(SessionKeys.UserLevel);
            if (string.IsNullOrEmpty(level))
            {
                context.Result = new UnauthorizedObjectResult("Please log in.");
            }
        }

        public void OnActionExecuted(ActionExecutedContext context)
        {
        }
    }
}
