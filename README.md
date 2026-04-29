# SiteOpt Web Interface

This package contains the web interface for Spine Toolbox [Siteopt](https://extgit.vtt.fi/siteopt/siteopt_toolbox) project. 
This web app can be built into a desktop app using [Tauri](https://v2.tauri.app/), 
which includes the Django backend and the Vue.js frontend. Older Python and Node.js 
versions may work but have not been tested.


## Running the production version

### Prerequisites
- Docker Desktop
- User account in registry.elexia.amct.pl
- Web Browser (Firefox, Chrome, Edge may work as well)

### Login and start web-app

Open Command Prompt and run:
```
docker login registry.elexia.amct.pl
```
Provide the username and password as requested.

Download `docker-compose.yml` file from the repo and save it to some folder.

cd into the folder with `docker-compose.yml` and pull the images

```commandline
docker compose pull
```

Then start the containers

```commandline
docker compose up
```

Open browser (Firefox, Chrome) and open URL

`http://localhost`

### To update to a new version (later, when available)
Get the updated `docker-compose.yml` file or update the tags yourself

Run

```commandline
docker compose pull
docker compose up
```

To start the containers in the background, run `docker compose up -d` instead.

### To stop and remove the containers

```docker compose down```

## Running the development version

The main Docker compose files are:

**docker-compose.dev.yml**  
- Used by developers  
- Runs the development or production version of the app  
- Builds images  

**docker-compose.yml**  
- Does NOT build  
- Only pulls images from a registry  
- Suitable for non‑developer users  

### Prerequisites
- Git
- Docker Desktop
- Web Browser (Firefox, Chrome, Edge may work as well)

### Checkout repo, build and start containers
1. Pull the main branch of this repo
2. cd to <repo root>
3. Start Docker Desktop
4. Run `docker compose -f docker-compose.dev.yml --profile dev up --build`
5. Open URL http://localhost:5173 in browser 

Once the development version is built, you can restart by omitting --build

```commandline
docker compose -f docker-compose.dev.yml --profile dev up
```

### Building for production and publishing the new images

1. Update `backend-prod` and `frontend-prod` tags in docker-compose.dev.yml

2. Run
 
```docker compose -f docker-compose.dev.yml --profile prod build```

3. Login to registry.elexia.amct.pl using developer account

```docker login registry.elexia.amct.pl```

4. Push the new images

```
docker push registry.elexia.amct.pl/site_opt/backend-prod:0.1
docker push registry.elexia.amct.pl/site_opt/frontend-prod:0.1
```

## Setting up the development environment [For local use without Docker]

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
