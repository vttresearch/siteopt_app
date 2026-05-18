## Run Tauri app (without bundling)

Cd to <repo-root>

````commandline
cd siteoptapp/frontend
````

Run tauri in dev mode

```commandline
npx tauri dev
```

This will open the Django backend in a subprocess, the Vite Dev server in another
subprocess, and the Tauri app in a separate window (not browser).

**This only works on Windows** for now because `npx tauri dev` runs
`start-backend.bat` to start the backend automatically. See `tauri.conf.json`.


## Build a full-stack desktop application using Tauri

Install [tauri](https://v2.tauri.app/) into your npm env if not present.

On Windows run

```commandline
build_tauri.bat
```

If you want to build it manually or for other OS's, this is what the batch file does:

1. Builds Django backend into an executable using PyInstaller `pyinstaller --onefile run_django.py`
2. Moves resulting `run_django.exe` into `<repo-root>/siteoptapp/frontend/src-tauri/backend`
3. Builds the Tauri desktop app with `npx tauri build`

This builds an .msi Windows installer into 
`<repo-root>/siteoptapp/frontend/src-tauri/target/release/bundle/msi`.
Running the installer installs the app on your desktop.
