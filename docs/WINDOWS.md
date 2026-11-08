# Windows setup

## `docker` is not recognized

That means **Docker Desktop is not installed** or its `docker.exe` is not on your `PATH`.

### Fix (required for assignment submission)

Graders run the app with **only** Docker. You need Docker Desktop on your machine to match that workflow before you submit.

1. Download and install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
2. Start **Docker Desktop** and wait until it says the engine is running.
3. **Close and reopen** PowerShell (or Cursor’s terminal).
4. From the project root:

   ```powershell
   cd "C:\School admission System"
   .\run.ps1
   ```

Optional (Admin PowerShell):

```powershell
winget install -e --id Docker.DockerDesktop
```

Reboot if the installer asks you to.

### If Docker is installed but the terminal still fails

Docker is often here but not on `PATH` until you restart the shell:

```text
C:\Program Files\Docker\Docker\resources\bin\docker.exe
```

`.\run.ps1` tries to add that folder automatically. If it still fails, log out and back in, or reboot.

### Develop without Docker (temporary)

You still need **PostgreSQL** listening on `localhost:5432` with database `school_admission` (user/password `postgres` / `postgres`).

```powershell
.\scripts\run-local.ps1
```

- API: http://localhost:8080  
- UI: http://localhost:5173  

This is for daily development only. Confirm everything with `.\run.ps1` (Docker) before submitting.
