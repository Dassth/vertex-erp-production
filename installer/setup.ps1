# ---------------------------------------------------------------------------
# Vertex ERP setup for Windows - Back Moon Devs
#
# MAIN computer (Administrator 1): installs Vertex ERP with its own PostgreSQL
#   database, starts it with Windows (a scheduled task, no login needed), opens
#   the firewall to this network only, and puts "Vertex ERP" on the desktop
#   (http://localhost:4580/admin1).
# SECOND computer (Administrator 2): only a "Vertex ERP" desktop icon that
#   opens the main computer's address /admin2 - the data stays on the main one.
#
# Running setup again on the main computer upgrades the program and never
# touches the data in C:\ProgramData\VertexERP.
#
# Plain ASCII on purpose: Windows PowerShell 5.1 reads scripts in the ANSI code page.
# ---------------------------------------------------------------------------
param([string]$Payload = '')

$ErrorActionPreference = 'Stop'
$LicenceId = '@@LICENCE_ID@@'
$Customer = '@@CUSTOMER@@'
$Version = '@@VERSION@@'
$Port = 4580
$TaskName = 'Vertex ERP Server'
$Prog = Join-Path $env:ProgramFiles 'VertexERP'
$Data = Join-Path $env:ProgramData 'VertexERP'
if (-not $Payload) { $Payload = Join-Path $PSScriptRoot 'payload.zip' }

# --- run as administrator ---------------------------------------------------
$me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Payload', "`"$Payload`"")
  exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

function Say([string]$text, [string]$title = 'Vertex ERP Setup', [string]$icon = 'Information') {
  [void][System.Windows.Forms.MessageBox]::Show($text, $title, 'OK', $icon)
}

function Find-Browser {
  foreach ($name in @('msedge.exe', 'chrome.exe')) {
    foreach ($root in @('HKLM:', 'HKCU:')) {
      $key = "$root\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$name"
      if (Test-Path $key) {
        $path = (Get-ItemProperty $key).'(default)'
        if ($path -and (Test-Path $path)) { return $path }
      }
    }
  }
  foreach ($p in @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

# A desktop and Start-menu icon that opens Vertex ERP in its own window, like any program.
function New-AppShortcut([string]$url, [string]$icon) {
  $shell = New-Object -ComObject WScript.Shell
  $browser = Find-Browser
  $menu = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Vertex ERP'
  New-Item -ItemType Directory -Force -Path $menu | Out-Null
  foreach ($folder in @((Join-Path $env:PUBLIC 'Desktop'), $menu)) {
    $link = $shell.CreateShortcut((Join-Path $folder 'Vertex ERP.lnk'))
    if ($browser) {
      $link.TargetPath = $browser
      $link.Arguments = "--app=$url"
    } else {
      $link.TargetPath = 'explorer.exe'
      $link.Arguments = $url
    }
    if ($icon -and (Test-Path $icon)) { $link.IconLocation = $icon }
    $link.Description = 'Vertex ERP'
    $link.Save()
  }
  return $menu
}

function Wait-Server([string]$url, [int]$seconds) {
  $until = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $until) {
    try {
      $r = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch { }
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Seconds 2
  }
  return $false
}

function Stop-Vertex {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  }
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.ExecutablePath -like "$Prog\*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $pgctl = Join-Path $Prog 'pgsql\bin\pg_ctl.exe'
  if ((Test-Path $pgctl) -and (Test-Path (Join-Path $Data 'db\PG_VERSION'))) {
    & $pgctl stop -D (Join-Path $Data 'db') -m fast -w -t 120 2>$null | Out-Null
  }
}

function Grant([string]$path, [string]$who, [string]$rights) {
  & icacls.exe $path /grant "${who}:$rights" /T /C /Q | Out-Null
}

function Get-LanAddress {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Sort-Object -Property InterfaceMetric | Select-Object -First 1
  if ($ip) { return $ip.IPAddress }
  return ''
}

function Install-Main([string]$copyDir, $status) {
  $status.Text = 'Stopping an earlier Vertex ERP, if any...'; [System.Windows.Forms.Application]::DoEvents()
  Stop-Vertex

  $status.Text = 'Copying the program (about a minute)...'; [System.Windows.Forms.Application]::DoEvents()
  foreach ($part in @('app', 'node', 'pgsql')) { if (Test-Path (Join-Path $Prog $part)) { Remove-Item -Recurse -Force (Join-Path $Prog $part) } }
  New-Item -ItemType Directory -Force -Path $Prog | Out-Null
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (Test-Path $tar) { & $tar -xf $Payload -C $Prog } else { Expand-Archive -Path $Payload -DestinationPath $Prog -Force }
  if (-not (Test-Path (Join-Path $Prog 'app\main.js'))) { throw 'The program files could not be copied.' }

  $status.Text = 'Preparing the data folder...'; [System.Windows.Forms.Application]::DoEvents()
  foreach ($sub in @('', 'backups', 'logs')) { New-Item -ItemType Directory -Force -Path (Join-Path $Data $sub) | Out-Null }
  $cfgPath = Join-Path $Data 'config.json'
  $cfg = @{}
  if (Test-Path $cfgPath) {
    (Get-Content $cfgPath -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
  }
  $cfg['port'] = $Port
  $cfg['licenceId'] = $LicenceId
  $cfg['appVersion'] = "vertex-erp@$Version"
  $cfg['backupCopyDir'] = $copyDir
  if (-not $cfg.ContainsKey('backupKeep')) { $cfg['backupKeep'] = 168 }
  if (-not $cfg.ContainsKey('backupEveryMin')) { $cfg['backupEveryMin'] = 60 }
  ($cfg | ConvertTo-Json) | Set-Content -Path $cfgPath -Encoding ASCII
  if ($copyDir) { New-Item -ItemType Directory -Force -Path $copyDir | Out-Null }

  # The server runs as NETWORK SERVICE, as PostgreSQL's own installer does.
  Grant $Data '*S-1-5-20' '(OI)(CI)M'
  if ($copyDir) { Grant $copyDir '*S-1-5-20' '(OI)(CI)M' }
  # The database password in config.json: only Windows, administrators and the server.
  & icacls.exe $cfgPath /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' '*S-1-5-20:M' /Q | Out-Null

  $status.Text = 'Starting Vertex ERP with Windows...'; [System.Windows.Forms.Application]::DoEvents()
  $node = Join-Path $Prog 'node\node.exe'
  $main = Join-Path $Prog 'app\main.js'
  $action = New-ScheduledTaskAction -Execute $node -Argument "`"$main`" service --home `"$Data`"" -WorkingDirectory (Join-Path $Prog 'app')
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\NETWORKSERVICE' -LogonType ServiceAccount
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $principal -Settings $settings -Description 'Vertex ERP database and server (Back Moon Devs)' -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName

  $status.Text = 'Opening this network for the second computer...'; [System.Windows.Forms.Application]::DoEvents()
  Get-NetFirewallRule -DisplayName 'Vertex ERP' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName 'Vertex ERP' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null

  $status.Text = 'Waiting for the database to start (first time: about a minute)...'; [System.Windows.Forms.Application]::DoEvents()
  if (-not (Wait-Server "http://127.0.0.1:$Port" 240)) {
    throw "Vertex ERP did not start. Please send the files in $Data\logs to Back Moon Devs."
  }

  $icon = Join-Path $Prog 'VertexERP.ico'
  $menu = New-AppShortcut "http://localhost:$Port/admin1" $icon
  $shell = New-Object -ComObject WScript.Shell
  $b = $shell.CreateShortcut((Join-Path $menu 'Vertex ERP backups.lnk')); $b.TargetPath = (Join-Path $Data 'backups'); $b.Save()
  $u = $shell.CreateShortcut((Join-Path $menu 'Uninstall Vertex ERP.lnk'))
  $u.TargetPath = 'powershell.exe'
  $u.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Prog\uninstall.ps1`""
  $u.Save()

  $ip = Get-LanAddress
  $second = "http://$($ip):$Port/admin2"
  $notes = @(
    'Vertex ERP - Back Moon Devs',
    "Licence: $LicenceId ($Customer)   Version: $Version",
    '',
    "This computer (Administrator 1):  http://localhost:$Port/admin1",
    "Second computer (Administrator 2): $second",
    "   or by name:                     http://$($env:COMPUTERNAME):$Port/admin2",
    '',
    "Data:     $Data\db",
    "Backups:  $Data\backups (every hour, 7 days)",
    "Copy:     $(if ($copyDir) { "$copyDir (one per day, 400 days)" } else { 'not set - run setup again to choose a second drive' })",
    '',
    'Keep this computer switched on while the second computer is used.',
    'Ask your network person to reserve this IP address for this computer in the router.'
  )
  $notes | Set-Content -Path (Join-Path $Data 'README.txt') -Encoding ASCII
  return $second
}

function Install-Second([string]$address, $status) {
  $address = $address.Trim() -replace '^https?://', '' -replace '/.*$', ''
  if ($address -notmatch ':\d+$') { $address = "$($address):$Port" }
  $status.Text = "Checking the main computer at $address..."; [System.Windows.Forms.Application]::DoEvents()
  $reachable = Wait-Server "http://$address" 20
  if (-not $reachable) {
    $answer = [System.Windows.Forms.MessageBox]::Show("The main computer did not answer at http://$address.`n`nIs it switched on, and on the same network?`n`nCreate the icon anyway?", 'Vertex ERP Setup', 'YesNo', 'Warning')
    if ($answer -ne 'Yes') { throw 'Setup stopped. Nothing was changed.' }
  }
  New-Item -ItemType Directory -Force -Path $Prog | Out-Null
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (Test-Path $tar) { & $tar -xf $Payload -C $Prog 'VertexERP.ico' 'uninstall.ps1' 2>$null }
  $menu = New-AppShortcut "http://$address/admin2" (Join-Path $Prog 'VertexERP.ico')
  $shell = New-Object -ComObject WScript.Shell
  $u = $shell.CreateShortcut((Join-Path $menu 'Uninstall Vertex ERP.lnk'))
  $u.TargetPath = 'powershell.exe'
  $u.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Prog\uninstall.ps1`""
  $u.Save()
  return "http://$address/admin2"
}

# --- the window ---------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "Vertex ERP Setup - $Customer"
$form.Size = New-Object System.Drawing.Size(560, 470)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
if (Test-Path (Join-Path $PSScriptRoot 'VertexERP.ico')) { $form.Icon = New-Object System.Drawing.Icon (Join-Path $PSScriptRoot 'VertexERP.ico') }

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Install Vertex ERP on this computer'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$title.Location = '20,16'; $title.Size = '510,32'
$form.Controls.Add($title)

$rbMain = New-Object System.Windows.Forms.RadioButton
$rbMain.Text = 'MAIN computer - Administrator 1. Keeps the database and runs Vertex ERP.'
$rbMain.Location = '24,60'; $rbMain.Size = '500,40'; $rbMain.Checked = $true
$form.Controls.Add($rbMain)

$lblCopy = New-Object System.Windows.Forms.Label
$lblCopy.Text = 'Second backup copy (another drive, USB disk or synced folder) - recommended:'
$lblCopy.Location = '44,104'; $lblCopy.Size = '480,22'
$form.Controls.Add($lblCopy)

$txtCopy = New-Object System.Windows.Forms.TextBox
$txtCopy.Location = '44,128'; $txtCopy.Size = '380,26'
$sysDrive = $env:SystemDrive.TrimEnd(':')
$other = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Name -ne $sysDrive -and $_.Free -gt 1GB -and $_.Name.Length -eq 1 } | Select-Object -First 1
if ($other) { $txtCopy.Text = "$($other.Name):\VertexERP-Backups" }
$form.Controls.Add($txtCopy)

$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Text = 'Browse...'; $btnBrowse.Location = '430,127'; $btnBrowse.Size = '90,28'
$btnBrowse.Add_Click({ $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq 'OK') { $txtCopy.Text = Join-Path $d.SelectedPath 'VertexERP-Backups' } })
$form.Controls.Add($btnBrowse)

$rbSecond = New-Object System.Windows.Forms.RadioButton
$rbSecond.Text = 'SECOND computer - Administrator 2. Uses the main computer''s database.'
$rbSecond.Location = '24,176'; $rbSecond.Size = '500,40'
$form.Controls.Add($rbSecond)

$lblAddr = New-Object System.Windows.Forms.Label
$lblAddr.Text = 'Main computer address (shown when it was installed), e.g. 192.168.1.10:'
$lblAddr.Location = '44,220'; $lblAddr.Size = '480,22'
$form.Controls.Add($lblAddr)

$txtAddr = New-Object System.Windows.Forms.TextBox
$txtAddr.Location = '44,244'; $txtAddr.Size = '380,26'; $txtAddr.Enabled = $false
$form.Controls.Add($txtAddr)

$status = New-Object System.Windows.Forms.Label
$status.Location = '24,296'; $status.Size = '500,44'; $status.ForeColor = [System.Drawing.Color]::DimGray
$status.Text = "Licence $LicenceId - version $Version"
$form.Controls.Add($status)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = 'Install'; $btnInstall.Location = '316,360'; $btnInstall.Size = '100,36'
$form.Controls.Add($btnInstall)
$form.AcceptButton = $btnInstall

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = 'Cancel'; $btnCancel.Location = '424,360'; $btnCancel.Size = '100,36'
$btnCancel.Add_Click({ $form.Close() })
$form.Controls.Add($btnCancel)
$form.CancelButton = $btnCancel

$toggle = {
  $txtCopy.Enabled = $rbMain.Checked; $btnBrowse.Enabled = $rbMain.Checked; $txtAddr.Enabled = $rbSecond.Checked
  if ($rbSecond.Checked) { $txtAddr.Focus() | Out-Null }
}
$rbMain.Add_CheckedChanged($toggle)
$rbSecond.Add_CheckedChanged($toggle)

$btnInstall.Add_Click({
  if ($rbSecond.Checked -and -not $txtAddr.Text.Trim()) { Say 'Enter the main computer''s address.' 'Vertex ERP Setup' 'Warning'; $txtAddr.Focus() | Out-Null; return }
  $btnInstall.Enabled = $false; $btnCancel.Enabled = $false; $rbMain.Enabled = $false; $rbSecond.Enabled = $false
  $form.Cursor = 'WaitCursor'
  try {
    if ($rbMain.Checked) {
      $second = Install-Main $txtCopy.Text.Trim() $status
      Say "Vertex ERP is installed and running.`n`nThis computer: use the Vertex ERP icon on the desktop (Administrator 1).`n`nOn the SECOND computer, run this same setup, choose 'Second computer' and enter:`n`n    $($second -replace '^http://', '' -replace ':4580/admin2$', '')`n`nIts Vertex ERP address will be $second`n`n(These details are saved in $Data\README.txt)"
    } else {
      $url = Install-Second $txtAddr.Text $status
      Say "Done. The Vertex ERP icon on this desktop opens $url (Administrator 2)."
    }
    $form.Close()
  } catch {
    $form.Cursor = 'Default'
    $status.Text = 'Setup did not finish.'
    Say "Setup could not finish:`n`n$($_.Exception.Message)" 'Vertex ERP Setup' 'Error'
    $btnInstall.Enabled = $true; $btnCancel.Enabled = $true; $rbMain.Enabled = $true; $rbSecond.Enabled = $true
  }
})

[void]$form.ShowDialog()
