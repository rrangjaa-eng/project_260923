using System.Text.Json;
using Microsoft.Win32;

namespace TremorHand;

internal static class NativeHostRegistration
{
    internal const string HostName = "kr.tremor_helper.hand";
    private static readonly string[] RegistryRoots =
    {
        @"Software\Google\Chrome\NativeMessagingHosts",
        @"Software\Microsoft\Edge\NativeMessagingHosts",
        @"Software\Naver\Naver Whale\NativeMessagingHosts"
    };

    internal static void Register(string extensionId)
    {
        if (!IsExtensionId(extensionId))
        {
            throw new ArgumentException("확장 ID는 a~p 소문자 32자여야 합니다.", nameof(extensionId));
        }

        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("실행 파일 경로를 찾지 못했습니다.");
        var stateDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TremorHand");
        Directory.CreateDirectory(stateDir);
        var manifestPath = Path.Combine(stateDir, "native-host.json");
        var manifest = new NativeHostManifest(
            HostName,
            "손 떨림 도우미 휴대형 손",
            executable,
            "stdio",
            new[] { $"chrome-extension://{extensionId}/" });
        File.WriteAllText(manifestPath, JsonSerializer.Serialize(manifest, HandJsonContext.Default.NativeHostManifest));

        foreach (var root in RegistryRoots)
        {
            using var key = Registry.CurrentUser.CreateSubKey($@"{root}\{HostName}", true)
                ?? throw new InvalidOperationException("Native Messaging 등록 키를 만들지 못했습니다.");
            key.SetValue(null, manifestPath, RegistryValueKind.String);
        }
        Console.WriteLine("휴대형 손 연결을 등록했습니다. 브라우저에서 확장을 다시 열어 주세요.");
    }

    internal static void Unregister()
    {
        foreach (var root in RegistryRoots)
        {
            using var parent = Registry.CurrentUser.OpenSubKey(root, true);
            parent?.DeleteSubKeyTree(HostName, false);
        }
        var manifestPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TremorHand", "native-host.json");
        if (File.Exists(manifestPath))
        {
            File.Delete(manifestPath);
        }
        Console.WriteLine("휴대형 손 연결을 안전하게 해제했습니다.");
    }

    private static bool IsExtensionId(string value) => value.Length == 32 && value.All(character => character is >= 'a' and <= 'p');
}
