# ---------------------------------------------------------------------------
# Remove Vertex ERP from this computer - Back Moon Devs
#
# Removes the program, the start-with-Windows task, the firewall rule and the
# icons. The DATA (C:\ProgramData\VertexERP: database and backups) is KEPT;
# installing again picks it up. Plain ASCII on purpose (Windows PowerShell 5.1).
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Continue'
$TaskName = 'Vertex ERP Server'
$Prog = Join-Path $env:ProgramFiles 'VertexERP'
$Data = Join-Path $env:ProgramData 'VertexERP'

$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  exit
}

Add-Type -AssemblyName System.Windows.Forms
$answer = [System.Windows.Forms.MessageBox]::Show("Remove Vertex ERP from this computer?`n`nYour data and backups in $Data are KEPT.", 'Uninstall Vertex ERP', 'YesNo', 'Question')
if ($answer -ne 'Yes') { exit }

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -like "$Prog\*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$pgctl = Join-Path $Prog 'pgsql\bin\pg_ctl.exe'
if ((Test-Path $pgctl) -and (Test-Path (Join-Path $Data 'db\PG_VERSION'))) { & $pgctl stop -D (Join-Path $Data 'db') -m fast -w -t 120 2>$null | Out-Null }

Get-NetFirewallRule -DisplayName 'Vertex ERP' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $env:PUBLIC 'Desktop\Vertex ERP.lnk')
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Vertex ERP')

# The script itself lives in $Prog, so remove the folder after this window closes.
Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList "/c timeout /t 3 >nul & rmdir /s /q `"$Prog`""
[void][System.Windows.Forms.MessageBox]::Show("Vertex ERP was removed.`n`nYour data is still in $Data.", 'Uninstall Vertex ERP', 'OK', 'Information')
