# SiteOpt Web Interface

This package contains the web interface for Spine Toolbox [Siteopt](https://extgit.vtt.fi/siteopt/siteopt_toolbox) project. 
This web app can be built into a desktop app using [Tauri](https://v2.tauri.app/), 
which includes the Django backend and the Vue.js frontend. Older Python and Node.js 
versions may work but have not been tested.

## Setting up the development environment

### Pull Git submodules

Siteopt_data and siteopt_toolbox repositories are under siteopt-web-interface as git submodules. After cloning the repository, pull the submodules:

```commandline
git submodule update --init --recursive
```

Later, if the submodules have been updated to point to a newer commit, do

```commandline
git pull --recurse-submodules
```

### Install Python Packages (requires Python 3.11+)

Make Python virtual environment. Open Command prompt and type

```commandline
python -m venv .venv
```

Activate

```commandline
.venv\Scripts\activate
```

Install Python requirements

```commandline
python install -r requirements.txt

or

python -m pip install -r requirements.txt
```

Initialize server database

```commandline
python manage.py makemigrations
python manage.py migrate
```


### Install JavaScript Packages (requires Node.js 22.15+)

Cd to frontend

```commandline
cd siteoptapp\frontend
```

Make npm environment for Vue.js frontend

```commandline
npm install
```

cd back to folder containing manage.py

```commandline
cd ..
cd ..
```


### Start Development Servers

Activate venv, if not already active

```commandline
.venv\Scripts\activate
```

**Start Django server**

```commandline
python manage.py runserver
```

Open **a second command prompt**

cd to folder containing manage.py

```commandline
cd siteoptapp\frontend
```

**Start Vite server**

```commandline
npm run dev
```

Open browser and go to url

http://localhost:5173


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

## Test Production Mode (Possibly outdated)

Prerequisites: 
1. Make a Python venv and install requirements with `pip install -r requirements.txt` 
2. Install the Node packages for Vue.js frontend with `npm install` 

Cd to repo root

Build Vue.js app

```commandline
cd siteoptapp\frontend
```

```commandline
npm run build
```

cd back to folder containing `manage.py`

```commandline
cd ..
cd ..
```

Activate venv, if not already active

```commandline
.venv\Scripts\activate
```

Collect static files

```commandline
python manage.py collectstatic
```

cd back to repo root and edit `settings.py`. Set dev_mode in **DJANGO_VITE** settings 
to **False**.

```
"dev_mode": False
```

Start server

```commandline
python manage.py runserver
```

Open browser and go to url

http://localhost:5173


### Run in Production Mode

Set DEBUG to False in settings.py

```
DEBUG = False
```

Set list of hosts to ALLOWED_HOSTS

```
ALLOWED_HOSTS = []
```

Remove Django Browser Reload from **INSTALLED_APPS** and **MIDDLEWARE**.

In addition, follow the instructions here https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

## Docker Production Persistence

The production compose file now stores backend state on the host instead of only in the container writable layer.

Production storage is versioned by `APP_VERSION`, and `APP_VERSION` must be set explicitly for production deployments.

- Backend image: `registry.elexia.amct.pl/site_opt/backend:${APP_VERSION}`
- Frontend image: `registry.elexia.amct.pl/site_opt/frontend:${APP_VERSION}`
- Backend work folders are mounted from `./docker-data/releases/${APP_VERSION}/work` to `/app/work_container`
- SQLite is mounted from `./docker-data/releases/${APP_VERSION}/db` and the database file is stored at `/app/data/db.sqlite3`
- Redis data is mounted from `./docker-data/releases/${APP_VERSION}/redis`

This works on Windows with Docker Desktop as well as Linux. Relative bind mounts are resolved from the repository directory, so after:

```commandline
set APP_VERSION=1.2.3
docker compose -f docker-compose.prod.yml up -d
```

your persistent files will remain under `docker-data/releases/1.2.3/` even if the backend container is recreated.

If you want the data somewhere else, set `SITEOPT_DATA_ROOT` before starting Compose.

Windows PowerShell:

```powershell
$env:APP_VERSION = '1.2.3'
$env:SITEOPT_DATA_ROOT = 'D:/SiteOptData'
docker compose -f docker-compose.prod.yml up -d
```

Windows cmd.exe:

```commandline
set APP_VERSION=1.2.3
set SITEOPT_DATA_ROOT=D:/SiteOptData
docker compose -f docker-compose.prod.yml up -d
```

If you use the Windows launcher, you can pass the version directly:

```commandline
run_prod_windows.bat v1.0
```

If you do not pass an argument, `run_prod_windows.bat` will prompt for `APP_VERSION` before pulling and starting the stack.
The launcher stops the existing production stack before pulling and starting the selected version.

Linux/macOS:

```commandline
APP_VERSION=1.2.3 SITEOPT_DATA_ROOT=/srv/siteopt-data docker compose -f docker-compose.prod.yml up -d
```

If you use the Linux launcher, you can pass the version directly:

```commandline
./run_prod_linux.sh v1.0
```

If you do not pass an argument, `run_prod_linux.sh` will prompt for `APP_VERSION` before pulling and starting the stack. The script uses `xdg-open` when available to open the app URL automatically.
The launcher stops the existing production stack before pulling and starting the selected version.

With those values, the release-specific data will be stored under:

- `D:/SiteOptData/releases/1.2.3/work`
- `D:/SiteOptData/releases/1.2.3/db`
- `D:/SiteOptData/releases/1.2.3/redis`

If `APP_VERSION` is not set, Compose will stop with an `APP_VERSION is required` error instead of silently using `latest`.
