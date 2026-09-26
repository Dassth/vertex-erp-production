# Vertex ERP — offline installation on Windows

Vertex ERP runs entirely on the customer's own computers. Only the **licence check** uses the internet.

```
MAIN computer (Administrator 1)                 SECOND computer (Administrator 2)
  PostgreSQL 17 database + Vertex server   <──  Vertex ERP icon → http://<main-ip>:4580/admin2
  Vertex ERP icon → http://localhost:4580/admin1
  hourly backups (+ daily copy on another drive)
        │
        └── every 30 min ──► licence service (Back Moon Devs, internet)
```

## Build the installer (Back Moon Devs, on Windows)

1. Create the customer's licence on the control page (below), e.g. `VPP-2026-01`.
2. `npm run build:windows -- --licence VPP-2026-01 --customer "Vertex Print Pack"`
3. The result is `release\VertexERP-Setup-VPP-2026-01.exe` (about 70 MB): Node, PostgreSQL 17 and the
   app in one file, built with Windows' own IExpress. Copy it to a USB stick.

## Install at the customer

**Needs:** Windows 10/11 (64-bit), an administrator login, and **internet once** on the main computer so
the licence activates (a phone hotspot is fine).

### Main computer (Administrator 1)

1. Run `VertexERP-Setup-VPP-2026-01.exe`, allow the administrator prompt.
2. Choose **MAIN computer**. Keep or choose the **second backup copy** folder — another drive (e.g.
   `D:\VertexERP-Backups`), a USB disk that stays connected, or a Google Drive / OneDrive folder.
3. Press **Install**. The first start creates the database (about a minute).
4. Setup shows the address for the second computer (e.g. `192.168.1.10`). Write it down; it is also in
   `C:\ProgramData\VertexERP\README.txt`.
5. Open **Vertex ERP** on the desktop → it opens **Administrator 1** only. Set the password.
6. Ask the customer's network person to **reserve that IP address** for this computer in the router, so the
   second computer's link keeps working.

### Second computer (Administrator 2)

1. Run the same setup, choose **SECOND computer**, enter the main computer's address, press **Install**.
2. Open **Vertex ERP** on the desktop → it opens **Administrator 2** only. Set the password.

The main computer must be switched on while the second one works.

## What happens on the main computer

| What | Where |
|---|---|
| Program (Node, app, PostgreSQL) | `C:\Program Files\VertexERP` |
| Database | `C:\ProgramData\VertexERP\db` |
| Backups — every hour, kept 7 days | `C:\ProgramData\VertexERP\backups` |
| Second copy — one per day, kept 400 days | the folder chosen in setup |
| Logs | `C:\ProgramData\VertexERP\logs` |
| Starts with Windows | Task Scheduler → *Vertex ERP Server* (runs as NETWORK SERVICE, no login needed) |
| Network | Firewall rule *Vertex ERP*, TCP 4580, this local network only |

- Every save is committed by PostgreSQL before the screen shows it saved. Refreshing, closing the window or
  restarting the computer loses nothing. After a power cut PostgreSQL repairs itself on the next start
  (tested: 500 rows written, database killed, all 500 present after restart).
- If the server or the database stops, the service starts it again within seconds.
- Running setup again **upgrades** the program; the database and backups are never touched.
- *Uninstall Vertex ERP* (Start menu) removes the program and **keeps the data**.

## Licence control (Back Moon Devs)

Control page: **https://vertex-licence.suryadass010405.workers.dev/admin** — the admin key is in
`BackMoonDevs-Licence-KEEP-SECRET.txt` (Documents on the Back Moon Devs computer; never in this repository).

| Button | Effect on the customer's computers |
|---|---|
| **Activate** | Works normally |
| **Suspend** | Locked — shows your message (e.g. "Payment pending — call 8940095659") |
| **Deactivate** | Locked — for a permanent stop |

- The customer's copy asks every 30 minutes; pressing **Check again** on the lock screen asks at once.
- **Offline days allowed** (per licence): how long a copy keeps working without reaching the licence service.
  After that it asks to be connected to the internet. Turning the computer's clock back is detected.
- A locked copy **never deletes anything**: data stays, backups keep running, and everything opens again when
  the licence is active.
- Answers are signed (Ed25519); the app holds only the public key, so an edited or invented answer is refused.

To redeploy the licence service: `npm run licence:deploy`; secrets `LICENCE_SIGNING_KEY` and `ADMIN_KEY`
come from the secrets file (`npx wrangler secret put <NAME> --config licence/wrangler.jsonc`).

## Restore a backup (new computer or disk failure)

Open **Command Prompt as administrator** on the main computer:

```bat
schtasks /end /tn "Vertex ERP Server"
cd "C:\Program Files\VertexERP"
node\node.exe app\main.js restore "D:\VertexERP-Backups\vertex-erp-backup-2026-09-26-054315Z.zip"
node\node.exe app\main.js restore "D:\VertexERP-Backups\vertex-erp-backup-2026-09-26-054315Z.zip" --confirm
schtasks /run /tn "Vertex ERP Server"
```

- The first `restore` only checks the backup and shows what would change; `--confirm` restores it.
- The data there before is saved as a backup first, so a wrong restore can be undone the same way.
- Backups carry no passwords: each administrator sets a new password at the next sign-in.
- On a new computer: install with setup first, then restore.

Tested: backup → restore an older backup → restore the automatic "before" copy → the data was back exactly.

## Online copies

The Cloudflare copy (`vertex-erp.suryadass010405.workers.dev`) is switched off (`wrangler.jsonc`). Every
non-development server now needs `LICENCE_ID`; a hosted copy without one (e.g. Render) shows the licence lock
and opens nothing. Suspend the Render service in its dashboard to stop it completely.
