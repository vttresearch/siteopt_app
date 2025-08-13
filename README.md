# SiteOpt Web Interface

This package contains the web interface for Spine Toolbox [Siteopt](https://extgit.vtt.fi/siteopt/siteopt_toolbox),
project. A web server and a browser are needed to use the interface.

## Install Python Packages

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

## Install JavaScript Packages

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

## Run in Development Mode

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

http://127.0.0.1:8000


## Test Production Mode

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

http://127.0.0.1:8000


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
