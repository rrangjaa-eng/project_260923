param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-p]{32}$')]
    [string] $ExtensionId,
    [string] $Output = "$PSScriptRoot\dist"
)

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'TremorHand\TremorHand.csproj'
dotnet publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o $Output

$start = @"
@echo off
cd /d "%~dp0"
TremorHand.exe register $ExtensionId
pause
"@
$stop = @"
@echo off
cd /d "%~dp0"
TremorHand.exe unregister
pause
"@
Set-Content -Path (Join-Path $Output '시작하기.cmd') -Value $start -Encoding ascii
Set-Content -Path (Join-Path $Output '안전하게 종료.cmd') -Value $stop -Encoding ascii
Copy-Item (Join-Path $PSScriptRoot 'README.md') (Join-Path $Output 'README.md') -Force
Write-Host "USB에 복사할 폴더를 만들었습니다: $Output"
