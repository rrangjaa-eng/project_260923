using System.Text.Json;

namespace TremorHand;

internal static class Program
{
    private const int ProtocolVersion = 1;
    private static readonly TimeSpan MaxClockSkew = TimeSpan.FromSeconds(5);

    private static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length == 2 && args[0] == "register")
            {
                NativeHostRegistration.Register(args[1]);
                return 0;
            }
            if (args.Length == 1 && args[0] == "unregister")
            {
                NativeHostRegistration.Unregister();
                return 0;
            }
            return await RunNativeHostAsync();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static async Task<int> RunNativeHostAsync()
    {
        var input = Console.OpenStandardInput();
        var output = Console.OpenStandardOutput();
        var executor = new InputExecutor();
        var seen = new Queue<string>();
        var seenSet = new HashSet<string>(StringComparer.Ordinal);

        try
        {
            while (true)
            {
                HandRequest? request;
                try
                {
                    request = await NativeProtocol.ReadAsync(input, CancellationToken.None);
                }
                catch (Exception error) when (error is InvalidDataException or JsonException or EndOfStreamException)
                {
                    await NativeProtocol.WriteAsync(output, new HandResponse(ProtocolVersion, "invalid", "refused", error.Message), CancellationToken.None);
                    continue;
                }
                if (request is null)
                {
                    return 0;
                }

                var refusal = Validate(request, seenSet, executor);
                if (refusal is not null)
                {
                    await NativeProtocol.WriteAsync(output, new HandResponse(ProtocolVersion, request.RequestId, "refused", refusal), CancellationToken.None);
                    continue;
                }

                try
                {
                    executor.Execute(request);
                    Remember(request.RequestId, seen, seenSet);
                    await NativeProtocol.WriteAsync(output, new HandResponse(ProtocolVersion, request.RequestId, "completed", HostVersion: "0.1.0"), CancellationToken.None);
                }
                catch (Exception error) when (error is InvalidDataException or System.ComponentModel.Win32Exception)
                {
                    await NativeProtocol.WriteAsync(output, new HandResponse(ProtocolVersion, request.RequestId, "refused", error.Message), CancellationToken.None);
                }
            }
        }
        finally
        {
            try
            {
                executor.ReleaseButtons();
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // 프로세스가 끝나는 중 입력 해제가 거부되어도 stdio host 종료를 막지 않는다.
            }
        }
    }

    private static string? Validate(HandRequest request, HashSet<string> seen, InputExecutor executor)
    {
        if (request.Version != ProtocolVersion) return "version-mismatch";
        if (request.RequestId.Length is < 16 or > 128 || request.RequestId.Any(character => !(char.IsAsciiLetterOrDigit(character) || character is '-' or '_'))) return "invalid-request-id";
        if (seen.Contains(request.RequestId)) return "duplicate-request";
        var now = DateTimeOffset.UtcNow;
        DateTimeOffset expiry;
        try
        {
            expiry = DateTimeOffset.FromUnixTimeMilliseconds(request.ExpiresAt);
        }
        catch (ArgumentOutOfRangeException)
        {
            return "expired-request";
        }
        if (expiry < now || expiry > now + MaxClockSkew) return "expired-request";
        if (request.Action is not ("host.ping" or "emergency.stop") && !executor.IsAllowedBrowserActive()) return "browser-not-active";
        return null;
    }

    private static void Remember(string requestId, Queue<string> order, HashSet<string> seen)
    {
        seen.Add(requestId);
        order.Enqueue(requestId);
        while (order.Count > 1024)
        {
            seen.Remove(order.Dequeue());
        }
    }
}
