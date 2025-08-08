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

Install Python requirements

```commandline
python install -r requirements.txt
```

Initialize server database

```commandline
python manage.py makemigrations
python manage.py migrate
```

Collect static files [optional]

```commandline
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

cd back to folder containing manage.py

```commandline
cd ..
cd ..
```

## Start Vite and Django servers

Activate venv, if not already active

```commandline
.venv\Scripts\activate
```

Start Django server

```commandline
python manage.py runserver
```

Open **a second command prompt**

cd to folder containing manage.py

```commandline
cd siteoptapp\frontend
```

Start Vite server

```commandline
npm run dev
```

Open browser and go to url

http://127.0.0.1:8000
