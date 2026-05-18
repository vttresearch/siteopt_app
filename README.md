# SiteOpt Web Interface

This repository contains the web interface for Spine Toolbox [Siteopt](https://github.com/vttresearch/siteopt_toolbox) project. Below you can find 
instructions for how to install and start the program. Documentation of the software can be 
found on the Siteopt page.

## Running the production version (recommended for most users)

### Prerequisites
- Docker Desktop
- User account in https://registry.elexia.amct.pl
- Web Browser (Firefox, Chrome, Edge may work as well)

Install Docker Desktop from [Docker](https://www.docker.com/products/docker-desktop/) or Microsoft Store on Windows. Notice that you need administrator 
rights for this. If you install for Windows, open command prompt or Windows Powershell and install Windows Subsystem 
for Linux by command

```
wsl --update
```

Now start Docker Desktop from start menu.

### Login and start web-app
Open Command Prompt (cmd.exe) and run

```
docker login registry.elexia.amct.pl
```

Provide the username and password as requested.  

Download `docker-compose.yml` file from the repo and save it to some folder.

cd into the folder with `docker-compose.yml` and pull (download) the images

```commandline
docker compose pull
```

Then start the containers

```commandline
docker compose up
```

Open browser (Firefox, Chrome) and go to URL

```
http://localhost
```

### To upgrade to a new version (later, when available)
Get the updated `docker-compose.yml` file and run

```commandline
docker compose pull
docker compose up
```

To run the containers in the background, run `docker compose up -d` instead.

### To stop and remove the containers
```commandline
docker compose down
```

> [!WARNING]  
> Do not run `docker compose down -v` or you will lose all user accounts and projects.

## Running the development version
### Prerequisites
- Git
- Docker Desktop
- Web Browser (Firefox, Chrome, Edge may work as well)

### About Docker compose files
The main compose files are

**docker-compose.dev.yml**  
- Used by developers  
- Runs the development or production version of the app  
- Builds images  

**docker-compose.yml**  
- Does NOT build  
- Only pulls images from a registry  
- Suitable for non‑developer users  

### Checkout repo, pull submodules, build and start containers
1. Clone repo and checkout **main** branch
2. cd to <repo root>
3. Pull submodules `git submodule update --init --recursive`
4. Start Docker Desktop
5. Run `docker compose -f docker-compose.dev.yml --profile dev up --build`
6. Open URL http://localhost:5173

Next time when you want to start the app, you can omit the `--build` flag and run

```commandline
docker compose -f docker-compose.dev.yml --profile dev up
```

You need to rebuild the app only if the dependencies have changed. 

### Stopping the development containers
```commandline
docker compose -f docker-compose.dev.yml --profile dev down
```

### Getting the latest changes from Git
In <repo_root>, run

```commandline
git pull
```

If the submodules (*<repo_root>/siteopt_data* and *<repo_root>/siteopt_toolbox*) have been 
updated, run

```commandline
git pull --recurse-submodules
```

Then start the containers again

```commandline
docker compose -f docker-compose.dev.yml --profile dev up
```

### Building for production and publishing new images
1. Update `backend-prod` and `frontend-prod` tags in `docker-compose.dev.yml`

2. Run
 
    ```docker compose -f docker-compose.dev.yml --profile prod build```

3. Login to https://registry.elexia.amct.pl using developer account

    ```docker login registry.elexia.amct.pl```

4. Push the new images

    ```
    docker push registry.elexia.amct.pl/site_opt/backend-prod:<latest_tag>
    docker push registry.elexia.amct.pl/site_opt/frontend-prod:<latest_tag>
    ```

5. Update the new tags into `docker-compose.yml` and let users know that a new version is available.


## Setting up the development environment without Docker
### Pull Git submodules
siteopt_data and siteopt_toolbox repositories are under siteopt-opt as git submodules. After cloning 
the repository, pull the submodules:

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

```
http://localhost:5173
```
