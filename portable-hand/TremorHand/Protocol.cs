using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TremorHand;

internal sealed record HandRequest(
    int Version,
    string RequestId,
    string Action,
    long ExpiresAt,
    int? X,
    int? Y,
    int? Delta,
    string? Button);

internal sealed record HandResponse(
    int Version,
    string RequestId,
    string Status,
    string? Reason = null,
    string? HostVersion = null);

internal sealed record NativeHostManifest(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("path")] string Path,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("allowed_origins")] string[] AllowedOrigins);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(HandRequest))]
[JsonSerializable(typeof(HandResponse))]
[JsonSerializable(typeof(NativeHostManifest))]
internal sealed partial class HandJsonContext : JsonSerializerContext;

internal static class NativeProtocol
{
    internal const int MaxMessageBytes = 64 * 1024;

    internal static async Task<HandRequest?> ReadAsync(Stream input, CancellationToken cancellationToken)
    {
        var header = new byte[4];
        if (!await ReadExactlyOrEofAsync(input, header, cancellationToken))
        {
            return null;
        }

        var length = BinaryPrimitives.ReadInt32LittleEndian(header);
        if (length <= 0 || length > MaxMessageBytes)
        {
            throw new InvalidDataException("message-size");
        }

        var payload = new byte[length];
        await input.ReadExactlyAsync(payload, cancellationToken);
        return JsonSerializer.Deserialize(payload, HandJsonContext.Default.HandRequest)
            ?? throw new InvalidDataException("invalid-json");
    }

    internal static async Task WriteAsync(Stream output, HandResponse response, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.SerializeToUtf8Bytes(response, HandJsonContext.Default.HandResponse);
        var header = new byte[4];
        BinaryPrimitives.WriteInt32LittleEndian(header, payload.Length);
        await output.WriteAsync(header, cancellationToken);
        await output.WriteAsync(payload, cancellationToken);
        await output.FlushAsync(cancellationToken);
    }

    private static async Task<bool> ReadExactlyOrEofAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset), cancellationToken);
            if (read == 0)
            {
                if (offset == 0)
                {
                    return false;
                }
                throw new EndOfStreamException();
            }
            offset += read;
        }
        return true;
    }
}
