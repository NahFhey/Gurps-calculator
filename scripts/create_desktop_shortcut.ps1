param(
  [string]$ShortcutName = "GURPS VTT",
  [string]$ExecutablePath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($ExecutablePath)) {
  $ExecutablePath = Join-Path $repoRoot "release\\win-unpacked\\GURPS VTT.exe"
}

if (-not (Test-Path -LiteralPath $ExecutablePath)) {
  throw "Packaged executable not found at '$ExecutablePath'. Run 'npm run electron:pack' first."
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "$ShortcutName.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Resolve-Path -LiteralPath $ExecutablePath).Path
$shortcut.WorkingDirectory = Split-Path -Parent $shortcut.TargetPath
$shortcut.IconLocation = "$($shortcut.TargetPath),0"
$shortcut.Description = "Launch $ShortcutName"
$shortcut.Save()

Write-Output "Desktop shortcut created: $shortcutPath"
