# SiteOpt web interface

This package contains the web interface for Spine Toolbox [Siteopt](https://extgit.vtt.fi/siteopt/siteopt_toolbox),
project. A web server and a browser are needed to use the interface.

## Install Python stuff

Make Python virtual environment. Open Command prompt and type

```commandline
python -m venv .venv
```

Activate

```commandline
.venv\Scripts\activate
```

Initialize server database

```commandline
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic
```

## Install JavaScript stuff

Install `Node.js` if not available

Cd to frontend

```commandline
cd siteoptapp\frontend
```

Make npm environment for Vue.js frontend

```commandline
npm install
```

## Start Vite and Django servers

Open a new command prompt and cd to folder where manage.py is

Activate venv

```commandline
.venv\Scripts\activate
```

Start Django server

```commandline
python manage.py runserver
```

Open a new command prompt and cd to <repo_root>/siteoptapp/frontend

```commandline
cd <repo-root>/siteoptapp/frontend
```

Start Vite server

```commandline
npm run dev
```

Open browser and go to url

http://127.0.0.1:8000
