using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace TremorHand;

internal sealed class InputExecutor
{
    private const uint InputMouse = 0;
    private const uint MouseMove = 0x0001;
    private const uint LeftDown = 0x0002;
    private const uint LeftUp = 0x0004;
    private const uint RightDown = 0x0008;
    private const uint RightUp = 0x0010;
    private const uint Wheel = 0x0800;
    private const uint Absolute = 0x8000;
    private const uint VirtualDesk = 0x4000;
    private const int SmXVirtualScreen = 76;
    private const int SmYVirtualScreen = 77;
    private const int SmCxVirtualScreen = 78;
    private const int SmCyVirtualScreen = 79;

    private static readonly HashSet<string> AllowedProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "whale"
    };

    internal bool IsAllowedBrowserActive()
    {
        var window = GetForegroundWindow();
        if (window == IntPtr.Zero)
        {
            return false;
        }
        _ = GetWindowThreadProcessId(window, out var processId);
        try
        {
            return AllowedProcesses.Contains(Process.GetProcessById((int)processId).ProcessName);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    internal void Execute(HandRequest request)
    {
        switch (request.Action)
        {
            case "pointer.move":
                Move(Required(request.X, "x"), Required(request.Y, "y"));
                break;
            case "pointer.click":
                Move(Required(request.X, "x"), Required(request.Y, "y"));
                Click(request.Button ?? "left", 1);
                break;
            case "pointer.doubleClick":
                Move(Required(request.X, "x"), Required(request.Y, "y"));
                Click(request.Button ?? "left", 2);
                break;
            case "pointer.down":
                SendMouse(ButtonFlag(request.Button ?? "left", true));
                break;
            case "pointer.up":
                SendMouse(ButtonFlag(request.Button ?? "left", false));
                break;
            case "pointer.scroll":
                SendMouse(Wheel, unchecked((uint)Required(request.Delta, "delta")));
                break;
            case "emergency.stop":
                ReleaseButtons();
                break;
            case "host.ping":
                break;
            default:
                throw new InvalidDataException("action-not-allowed");
        }
    }

    internal void ReleaseButtons()
    {
        SendMouse(LeftUp);
        SendMouse(RightUp);
    }

    private static int Required(int? value, string name) => value ?? throw new InvalidDataException($"missing-{name}");

    private static uint ButtonFlag(string button, bool down) => button switch
    {
        "left" => down ? LeftDown : LeftUp,
        "right" => down ? RightDown : RightUp,
        _ => throw new InvalidDataException("button-not-allowed")
    };

    private static void Click(string button, int count)
    {
        for (var index = 0; index < count; index += 1)
        {
            SendMouse(ButtonFlag(button, true));
            SendMouse(ButtonFlag(button, false));
        }
    }

    private static void Move(int x, int y)
    {
        var left = GetSystemMetrics(SmXVirtualScreen);
        var top = GetSystemMetrics(SmYVirtualScreen);
        var width = GetSystemMetrics(SmCxVirtualScreen);
        var height = GetSystemMetrics(SmCyVirtualScreen);
        if (width <= 1 || height <= 1 || x < left || y < top || x >= left + width || y >= top + height)
        {
            throw new InvalidDataException("point-outside-virtual-screen");
        }

        var normalizedX = (int)Math.Round((x - left) * 65535.0 / (width - 1));
        var normalizedY = (int)Math.Round((y - top) * 65535.0 / (height - 1));
        SendMouse(MouseMove | Absolute | VirtualDesk, 0, normalizedX, normalizedY);
    }

    private static void SendMouse(uint flags, uint mouseData = 0, int dx = 0, int dy = 0)
    {
        var input = new Input
        {
            Type = InputMouse,
            Union = new InputUnion
            {
                Mouse = new MouseInput { Dx = dx, Dy = dy, MouseData = mouseData, Flags = flags }
            }
        };
        if (SendInput(1, new[] { input }, Marshal.SizeOf<Input>()) != 1)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Input { internal uint Type; internal InputUnion Union; }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion { [FieldOffset(0)] internal MouseInput Mouse; }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        internal int Dx;
        internal int Dy;
        internal uint MouseData;
        internal uint Flags;
        internal uint Time;
        internal UIntPtr ExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int index);
}
