import os
import json
import csv
import uuid
import openpyxl
import platformdirs
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.utils.timezone import now
from siteoptapp.models import ClientConfig

SITEOPTDATA = os.path.join("C:\\", "data", "GIT", "SITEOPT-DATA")
APP_DATA_DIR = "siteopt-app"  # The same as 'identifier' in tauri.conf.json
SETTINGS_DIR = "settings"
CONFIG_FILE = "config.json"


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
    print(f"Client {client_id} updating settings {action}")
    if action == "input_data_path":
        js = json.loads(request.body.decode("utf-8"))  # dict
        print(f"New input_data_path: {js[action]}")
        # Check if input_data_path is valid
        json_response = validate_input_data_path(js[action])
        if json_response["success"]:
            config = get_client_config(client_id)
            edit_config_file(config.config_path, {action: js[action]})
        return JsonResponse(json_response)
    elif action == "project_data_path":
        js = json.loads(request.body.decode("utf-8"))  # dict
        print(f"New project_path: {js[action]}")
        # Check if project_path is valid
        json_response = validate_project_path(js[action])
        if json_response["success"]:
            config = get_client_config(client_id)
            edit_config_file(config.config_path, {action: js[action]})
        return JsonResponse(json_response)
    else:
        print(f"Unknown action: {action}")
        return JsonResponse({"error", f"No handler for action {action}"})


def validate_input_data_path(p):
    if p == "":
        # Enables clearing the input data path
        return {"success": True}
    if not os.path.exists(p):
        return {"success": False, "error": "Path does not exist"}
    if "modelspec.xlsx" in os.listdir(p):
        return {"success": True}
    else:
        return {"success": False, "error": "Path is not a valid SiteOpt Data path."}


def validate_project_path(p):
    if p == "":
        # Enables clearing the project path
        return {"success": True}
    if not os.path.exists(p):
        return {"success": False, "error": "Path does not exist"}
    if ".spinetoolbox" in os.listdir(p):
        return {"success": True}
    else:
        return {"success": False, "error": "Path does not contain a Spine Toolbox project."}


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
    print(f"Client {client_id} requesting input files")
    config = get_client_config(client_id)
    config_d = read_config_file(config.config_path)
    p = config_d["input_data_path"]
    if not validate_input_data_path(p)["success"]:
        return JsonResponse({"success": False, "error": f"Invalid path '{p}'"})
    excluded_dirs = [os.path.join(p, ".git")]
    tree = build_tree(p, excluded_dirs)
    tree["name"] = "data"
    return JsonResponse({"success": True, "data": {"children": [tree]}})


def fetch_project_file_tree(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} requesting project files")
    config = get_client_config(client_id)
    config_d = read_config_file(config.config_path)
    p = config_d["project_data_path"]
    if not validate_project_path(p)["success"]:
        return JsonResponse({"success": False, "error": f"Invalid path '{p}'"})
    excluded_dirs = [os.path.join(p, ".git")]
    tree = build_tree(p, excluded_dirs)
    tree["name"] = "project"
    return JsonResponse({"success": True, "data": {"children": [tree]}})


def fetch_data(request, folder, fname):
    if folder == "root":
        p = os.path.join(SITEOPTDATA, fname)
    else:
        p = os.path.join(SITEOPTDATA, folder, fname)
    if not os.path.exists(p):
        return HttpResponse(json.dumps({}), content_type="application/json")
    if p.endswith(".xlsx"):
        wb = openpyxl.load_workbook(p)
        json_data = read_excel_as_json(wb)
        return HttpResponse(json_data, content_type="application/json")
    elif p.endswith(".csv"):
        json_data = read_csv_as_json(p)
        return HttpResponse(json_data, content_type="application/json")
    else:
        return HttpResponse(json.dumps({"error": f"Sending file {p} not implemented"}), content_type="application/json")


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
    return json.dumps(data)


def read_csv_as_json(p):
    """Reads csv data from given path and returns the data in JSON format."""
    data = {"filetype": "csv", "data": []}
    l = []
    with open(p, newline="") as fp:
        csv_reader = csv.reader(fp)
        i = 0
        for row in csv_reader:
            l.append(row)
            i += 1
    # Pivot the table
    pivoted_list = [[row[i] for row in l] for i in range(len(l[0]))]
    d = {}
    for r in pivoted_list:
        d[r.pop(0)] = r[1:]
    data["data"] = d
    return json.dumps(data)


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
    d = {"input_data_path": "",
         "project_data_path": ""}
    with open(p, "w") as fp:
        json.dump(d, fp, indent=4)


def edit_config_file(p, new_key_value):
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
