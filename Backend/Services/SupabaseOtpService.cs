#nullable enable
using System.Net.Http.Json;
using System.Text.Json;

namespace Artifax.Services
{
    /// <summary>
    /// Sends and checks the 6-digit login code that Supabase Auth emails to the user.
    /// This is the second step of login (after the password is checked by our own backend).
    ///
    /// Needs two environment variables on the server:
    ///   SUPABASE_URL       e.g. https://abcd1234.supabase.co
    ///   SUPABASE_ANON_KEY  the project's anon / publishable key (safe to use server-side)
    /// </summary>
    public class SupabaseOtpService
    {
        private readonly HttpClient httpClient;
        private readonly ILogger<SupabaseOtpService> logger;
        private readonly string? supabaseUrl;
        private readonly string? supabaseKey;

        public SupabaseOtpService(HttpClient httpClient, IConfiguration configuration, ILogger<SupabaseOtpService> logger)
        {
            this.httpClient = httpClient;
            this.logger = logger;
            supabaseUrl = (configuration["SUPABASE_URL"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL"))?.TrimEnd('/');
            supabaseKey = configuration["SUPABASE_ANON_KEY"] ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(supabaseUrl) && !string.IsNullOrWhiteSpace(supabaseKey);

        /// <summary>Asks Supabase to email a one-time code to this address.</summary>
        public async Task<(bool ok, string? error)> SendCodeAsync(string email, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return (false, "Email verification is not configured on the server (SUPABASE_URL / SUPABASE_ANON_KEY).");
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{supabaseUrl}/auth/v1/otp")
            {
                Content = JsonContent.Create(new { email, create_user = true })
            };
            request.Headers.Add("apikey", supabaseKey);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return (true, null);
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("Supabase OTP send failed ({Status}): {Body}", (int)response.StatusCode, body);

            if ((int)response.StatusCode == 429)
            {
                return (false, "Too many codes requested. Please wait a minute and try again.");
            }

            return (false, "Could not send the verification email. Please try again.");
        }

        /// <summary>
        /// Checks the code with Supabase. Returns the email Supabase confirmed, or null if the code is wrong/expired.
        /// </summary>
        public async Task<string?> VerifyCodeAsync(string email, string code, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                return null;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{supabaseUrl}/auth/v1/verify")
            {
                Content = JsonContent.Create(new { type = "email", email, token = code })
            };
            request.Headers.Add("apikey", supabaseKey);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogInformation("Supabase OTP verify rejected ({Status}): {Body}", (int)response.StatusCode, body);
                return null;
            }

            try
            {
                using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
                if (json.RootElement.TryGetProperty("user", out var user)
                    && user.TryGetProperty("email", out var verifiedEmail))
                {
                    return verifiedEmail.GetString();
                }
            }
            catch (JsonException exception)
            {
                logger.LogWarning(exception, "Could not read Supabase verify response.");
            }

            return null;
        }
    }
}
