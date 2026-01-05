import os
import json
import csv
import shutil
import uuid
import subprocess
import openpyxl
import platformdirs
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.utils.timezone import now
from siteoptapp.models import ClientConfig
from pathlib import Path
from django.conf import settings

APP_DATA_DIR = "siteopt-app"  # The same as 'identifier' in tauri.conf.json
SETTINGS_DIR = "settings"
WORK_DIR = "work"
CONFIG_FILE = "config.json"
JOBS = {}
INPUT_DATA_DIR = (Path(settings.BASE_DIR) / "siteopt_data").resolve()
PROJECT_DATA_DIR = (Path(settings.BASE_DIR) / "siteopt_toolbox").resolve()

def get_input_data_path() -> str:
    return str(INPUT_DATA_DIR)

def get_project_data_path() -> str:
    return str(PROJECT_DATA_DIR)

@ensure_csrf_cookie
def health_check(request):
    """For polling the backend."""
    return JsonResponse({"status": "ok"})


def settings(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} retrieving settings")
    new_client = False
    if not client_id:
        client_id = uuid.uuid4()
        new_client = True
    client_config = get_client_config(client_id)
    config_dict = read_config_file(client_config.config_path)
    print(f"[{new_client}] Responding with configs: {config_dict}")
    response = JsonResponse({"client_id": str(client_config.client_id), "configs": config_dict})
    if new_client:
        # httponly=False makes sure that we can access it from JavaScript
        response.set_cookie("client_id", client_id, httponly=False, samesite="Lax", max_age=31536000)  # 1 year
    return response


def get_client_config(client_id):
    """Returns ClientConfig model for given client id if available or a fresh one for new clients."""
    try:
        config = ClientConfig.objects.get(client_id=client_id)
        config.last_seen = now()
        config.save()
    except ClientConfig.DoesNotExist:
        base = platformdirs.user_data_dir()  # Win: %APPDATA%/Local
        config_file_dir = os.path.abspath(os.path.join(base, APP_DATA_DIR, SETTINGS_DIR, str(client_id)[0:6]))
        config_file_path = os.path.join(config_file_dir, CONFIG_FILE)
        # Create config dir and default config file if it doesn't exist
        make_dir(config_file_dir)
        make_config_file(config_file_path)
        config = ClientConfig.objects.create(
            client_id=client_id,
            config_path=config_file_path,
            last_seen=now()
        )
    return config


@csrf_protect
def post(request, action):
    """Handles data posted by the frontend.
    Requires that the POST from frontend includes csrftoken cookie and
    'credentials: 'include'.
    Note: @csrf_protect decorator is needed for views that modify data (POST, PUT, DELETE)
    """
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    js = json.loads(request.body.decode("utf-8"))  # dict
    if action == "input_data_path":
        return JsonResponse({"success": True})
    elif action == "project_data_path":
        return JsonResponse({"success": True})
    elif action == "make_work_folder":
        print(f"[{client_id}] creating work folder {js['work_folder']}")
        config = get_client_config(client_id)
        json_response = make_work_folder(config.config_path, client_id, js['work_folder'])
        return JsonResponse(json_response)
    elif action == "fetch_data":
        print(f"[{client_id}] fetching {js['path']}")
        response = fetch_data(js["path"])
        return JsonResponse(response)
    elif action == "execute":
        print(f"[{client_id}] executing {js['execute']}")
        client_config = get_client_config(client_id)
        config = read_config_file(client_config.config_path)
        work_folder_name = js["execute"][0]
        execution_type = js["execute"][1]
        project_path = config["work_folders"][work_folder_name]
        job_id = str(uuid.uuid4())
        JOBS[job_id] = [project_path, execution_type]
        return JsonResponse({"success": True, "data": job_id})
    elif action == "save_file":
        print(f"[{client_id}] saving {js.get('path')}")
        config = get_client_config(client_id)
        return JsonResponse(save_file(config.config_path, js))
    else:
        print(f"Unknown action: {action}")
        return JsonResponse({"success": False, "error": f"No handler for action {action}"})


def execute(request, job_id):
    print(f"Starting execution of job_id {job_id}")

    def event_stream():
        ppath = JOBS[job_id][0]
        exec_type = JOBS[job_id][1]
        args = [
            "C:/data/GIT/SITEOPT-WEB-INTERFACE/.venv_st/Scripts/python.exe",
            "-m",
            "spinetoolbox",
            "--execute-only",
            "--execute-remotely",
            "server_config.txt",
            ppath
        ]
        try:
            proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            for line in iter(proc.stdout.readline, b""):
                line = line.decode("utf-8", "ignore").strip()
                yield f"data: {line}\n\n"
            proc.stdout.close()
            proc_retval = proc.wait()
            JOBS.pop(job_id)
            # Notify frontend that execution is done
            yield f"event: done\ndata: Execution finished [{proc_retval}]\n\n"
        except OSError as e:
            print(f"[OSError] {e}")
            yield f"data: [OSError]: {e}\n\n"
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response["Cache-Control"] = "no-cache"
    return response


def validate_input_data_path(p):
    if not os.path.exists(p):
        return {"success": False, "error": "Path does not exist"}
    if "modelspec.xlsx" in os.listdir(p):
        return {"success": True}
    return {"success": False, "error": "Path is not a valid SiteOpt Data path."}


def validate_project_path(p):
    if not os.path.exists(p):
        return {"success": False, "error": "Path does not exist"}
    if ".spinetoolbox" in os.listdir(p):
        return {"success": True}
    return {"success": False, "error": "Path does not contain a Spine Toolbox project."}


def make_work_folder(config_fpath, client_id, work_folder_name):
    configs = read_config_file(config_fpath)
    idp = get_input_data_path()
    
    if not validate_input_data_path(idp)["success"]:
        return {"success": False, "error": f"Bundled input data is invalid: '{idp}'"}
    pdp = configs["project_data_path"]
    pdp = get_project_data_path()
    if not validate_project_path(pdp)["success"]:
        return {"success": False, "error": f"Bundled project data is invalid: '{pdp}'"}
    base = platformdirs.user_data_dir()  # Win: %APPDATA%/Local
    work_dir = os.path.abspath(os.path.join(base, APP_DATA_DIR, WORK_DIR, str(client_id)[0:6], work_folder_name))
    try:
        make_dir(work_dir)
        # Copy contents of project_data_path to work_dir
        shutil.copytree(pdp, work_dir, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
        # Copy contents of input_data_path to 'current_input' folder in the same work_dir
        shutil.copytree(idp, os.path.join(work_dir, "current_input"), dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
    except OSError as e:
        return {"success": False, "error": f"[OSError] [{e}] Creating work dir failed"}
    work_folders = configs.get("work_folders", {})
    if work_folder_name not in work_folders.keys():
        work_folders[work_folder_name] = work_dir
    edit_config_file(config_fpath, {"work_folders": work_folders})
    return {"success": True}


def build_tree(path, exclude_dirs=None):
    exclude_dirs = set(os.path.abspath(d) for d in (exclude_dirs or []))
    tree = {"children": []}
    entries = os.listdir(path)
    # Sort: files first, then directories
    entries.sort(key=lambda e: os.path.isdir(os.path.join(path, e)))
    for entry in entries:
        full_path = os.path.join(path, entry)
        abs_path = os.path.abspath(full_path)
        # Skip excluded directories
        if abs_path in exclude_dirs:
            continue
        if os.path.isdir(full_path):
            tree["children"].append({
                "name": entry,
                "children": build_tree(full_path, exclude_dirs)["children"]
            })
        else:
            tree["children"].append({"name": entry})
    return tree


def fetch_input_file_tree(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} is fetching input files")

    p = get_input_data_path()
    if not validate_input_data_path(p)["success"]:
        return JsonResponse({"success": False, "error": f"Bundled input data is invalid: '{p}'"})

    excluded_dirs = [os.path.join(p, ".git")]
    tree = build_tree(p, excluded_dirs)
    tree["name"] = "dummy"  # This name is not rendered anywhere
    return JsonResponse({"success": True, "data": tree})


def fetch_project_file_tree(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} is fetching project files")
    p = get_project_data_path()
    if not validate_project_path(p)["success"]:
        return JsonResponse({"success": False, "error": f"Bundled project data is invalid: '{p}'"})
    if not validate_project_path(p)["success"]:
        return JsonResponse({"success": False, "error": f"Invalid path '{p}'"})
    excluded_dirs = [os.path.join(p, ".git")]
    tree = build_tree(p, excluded_dirs)
    tree["name"] = "project"  # "project" is not rendered anywhere
    return JsonResponse({"success": True, "data": tree})


def fetch_work_folders_tree(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} is fetching work folder files")
    config = get_client_config(client_id)
    config_d = read_config_file(config.config_path)
    work_folders_dict = config_d["work_folders"]
    trees = list()
    for name, p in work_folders_dict.items():
        if not os.path.exists(p):
            print(f"Error building work folder tree: path:'{p}' does not exist")
            continue
        excluded_dirs = [os.path.join(p, ".git")]
        tree = build_tree(p, excluded_dirs)
        base_path, dirname = os.path.split(p)
        tree["name"] = dirname  # same as 'name'
        tree["path"] = base_path
        trees.append([tree])
    return JsonResponse({"success": True, "data": trees})


def fetch_data(fpath):
    if not os.path.exists(fpath):
        return {"success": False, "error": f"{fpath} does not exist"}
    if fpath.endswith(".xlsx"):
        wb = openpyxl.load_workbook(fpath)
        data = read_excel_as_json(wb)
        return {"success": True, "data": data}
    elif fpath.endswith(".csv"):
        data = read_csv_as_json(fpath)
        return {"success": True, "data": data}
    elif fpath.endswith(".json"):
        try:
            with open(fpath, "r", encoding="utf-8") as fh:
                obj = json.load(fh)
            return {"success": True, "data": {"filetype": "json", "data": obj}}
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Invalid JSON: {e}"}
        except OSError as e:
            return {"success": False, "error": f"[OSError] {e}"}
    elif fpath.endswith(".md"):
        try:
            with open(fpath, "r", encoding="utf-8") as fh:
                text = fh.read()
            return {"success": True, "data": {"filetype": "md", "data": {"text": text}}}
        except OSError as e:
            return {"success": False, "error": f"[OSError] {e}"}
    else:
        _, ext = os.path.splitext(fpath)
        return {"success": False, "error": f"Reading files with extension '{ext}' not implemented"}


def read_excel_as_json(wb):
    """Reads all sheets, rows, and columns from an Excel workbook object and returns the data in JSON format."""
    data = {"filetype": "xlsx", "data": {}}
    for sheet in wb:
        data["data"][sheet.title] = []
        rows = sheet.max_row
        columns = sheet.max_column
        for i in range(1, columns+1):
            column_data = []
            column_name = sheet.cell(row=1, column=i)
            for j in range(1, rows):
                row_data = sheet.cell(row=j+1, column=i)
                column_data.append(row_data.value)
            data["data"][sheet.title].append({column_name.value: column_data})
    return data


def read_csv_as_json(p):
    with open(p, newline="", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        rows = list(reader)
        cols = reader.fieldnames or []
    return {"filetype": "csv", "data": {"columns": cols, "rows": rows}}


def download_excel_file(request):
    fpath = os.path.join("C:\\", "Users", "ttepsa", "temp", "ms-excel-command-test.xlsx")
    wb = openpyxl.load_workbook(fpath)
    response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheeml.sheet")
    response["Content-Disposition"] = 'attachment; filename="ms-excel-file.xlsx"'
    # Save the workbook to the response
    wb.save(response)
    return response


def make_dir(p):
    """Create directory if it doesn't exist.

    Args:
        p: Absolute path to wanted dir

    Raises:
        OSError if operation failed.
    """
    os.makedirs(p, exist_ok=True)


def make_config_file(p):
    """Creates a dummy config file.

    Args:
        p (str): Full path to config file
    """
    d = {"input_data_path": get_input_data_path(),
         "project_data_path": get_project_data_path(),
         "work_folders": {}}
    with open(p, "w") as fp:
        json.dump(d, fp, indent=4)


def edit_config_file(p, new_key_value):
    print(f"new_key_value:{new_key_value}")
    config_d = read_config_file(p)
    config_d.update(new_key_value)
    with open(p, "w") as fp:
        json.dump(config_d, fp, indent=4)


def read_config_file(p):
    """Reads a file from given path and returns the contents as a dict.

    Args:
        p (str): Full path to config file
    """
    try:
        with open(p, "r") as fh:
            try:
                config_dict = json.load(fh)
            except json.decoder.JSONDecodeError:
                print(f"[JSONDecodeError] in config file {p}. Invalid JSON, maybe?")
                return {}
    except OSError:
        print(f"[OSError] Config file {p} missing, maybe?")
        return {}
    return config_dict

def is_path_inside_any_work_folder(config_fpath: str, target_path: str) -> bool:
    cfg = read_config_file(config_fpath)
    work_folders = cfg.get("work_folders", {})
    target = os.path.abspath(target_path)

    for wf in work_folders.values():
        wf_abs = os.path.abspath(wf)
        try:
            common = os.path.commonpath([target, wf_abs])
        except ValueError:
            continue
        if common == wf_abs:
            return True
    return False

def _save_md(fpath: str, data, meta: dict):
    # data can be either raw string or {"text": "..."} – allow both for flexibility
    if isinstance(data, dict):
        text = data.get("text", "")
    else:
        text = "" if data is None else str(data)

    if not fpath.endswith(".md"):
        return {"success": False, "error": "Not a .md file."}

    with open(fpath, "w", encoding="utf-8", newline="\n") as fp:
        fp.write(text)

    return {"success": True}

def _save_csv(fpath: str, data, meta: dict):
    if not isinstance(data, list):
        return {"success": False, "error": "csv save expects a list of row objects."}
    if len(data) == 0:
        return {"success": False, "error": "No data to save."}

    columns = meta.get("columns")
    if not columns:
        cols_set = set()
        for row in data:
            if isinstance(row, dict):
                cols_set.update(row.keys())
        columns = list(cols_set)

    with open(fpath, "w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in data:
            if not isinstance(row, dict):
                return {"success": False, "error": "Each CSV row must be an object/dict."}
            writer.writerow({c: row.get(c, "") for c in columns})

    return {"success": True}

def save_file(config_fpath: str, js: dict):
    fpath = js.get("path")
    filetype = js.get("filetype")
    data = js.get("data")
    meta = js.get("meta", {})  # optional, used by xlsx later (sheet name etc.)

    if not fpath or not filetype:
        return {"success": False, "error": "Missing 'path' or 'filetype'."}

    if not is_path_inside_any_work_folder(config_fpath, fpath):
        return {"success": False, "error": "Refusing to write outside work folders."}

    if not os.path.exists(fpath):
        return {"success": False, "error": f"File does not exist: {fpath}"}

    save_handlers = {
        "md": _save_md,
        # later:
        # "json": _save_json,
        "csv": _save_csv,
        # "xlsx": _save_xlsx,
    }

    handler = save_handlers.get(filetype)
    if not handler:
        return {"success": False, "error": f"Saving not implemented for '{filetype}'."}

    try:
        return handler(fpath, data, meta)
    except OSError as e:
        return {"success": False, "error": f"[OSError] {e}"}
    except Exception as e:
        return {"success": False, "error": f"[Error] {e}"}


