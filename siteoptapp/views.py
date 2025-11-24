import os
import json
import csv
import uuid
import openpyxl
import platformdirs
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse, Http404
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie


def download_excel_file(request):
    fpath = os.path.join("C:\\", "Users", "ttepsa", "temp", "ms-excel-command-test.xlsx")
    wb = openpyxl.load_workbook(fpath)
    response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = 'attachment; filename="ms-excel-file.xlsx"'
    # Save the workbook to the response
    wb.save(response)
    return response


from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def upload_file(request):
    """Handle file uploads to the data directory."""
    try:
        print(f"Upload request method: {request.method}")
        print(f"Upload request headers: {dict(request.headers)}")
        
        if request.method != 'POST':
            return JsonResponse({"success": False, "error": "Only POST method allowed"})
        
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        print(f"Client ID: {client_id}")
        
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        # For containerized deployment, always use bundled data path
        # This eliminates the need for complex per-client config files
        data_path = "/app/data"
        print(f"Using bundled data path: {data_path}")
        
        # Optional: Try to get client config but don't require it
        try:
            client_config = ClientConfig.objects.get(client_id=client_id)
            config_dict = read_config_file(client_config.config_path)
            if "input_data_path" in config_dict and config_dict["input_data_path"]:
                data_path = config_dict["input_data_path"]
                print(f"Using client-specific data path: {data_path}")
        except (ClientConfig.DoesNotExist, FileNotFoundError, json.JSONDecodeError):
            print("No client config found, using default bundled data path")
        
        if 'file' not in request.FILES:
            print(f"Available files: {list(request.FILES.keys())}")
            return JsonResponse({"success": False, "error": "No file provided"})
        
        uploaded_file = request.FILES['file']
        folder_path = request.POST.get('folder_path', '').strip('/')  # Optional folder path
        
        print(f"Uploading file: {uploaded_file.name}, size: {uploaded_file.size}")
        print(f"Folder path: {folder_path}")
        
        # Construct the full path
        if folder_path:
            full_path = os.path.join(data_path, folder_path)
        else:
            full_path = data_path
        
        print(f"Full upload path: {full_path}")
        
        # Ensure the directory exists
        os.makedirs(full_path, exist_ok=True)
        
        # Save the file
        file_path = os.path.join(full_path, uploaded_file.name)
        
        try:
            with open(file_path, 'wb') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            
            print(f"File saved successfully to: {file_path}")
            
            return JsonResponse({
                "success": True, 
                "message": f"File '{uploaded_file.name}' uploaded successfully",
                "file_path": file_path
            })
        except Exception as e:
            print(f"Error saving file: {str(e)}")
            return JsonResponse({"success": False, "error": f"Failed to save file: {str(e)}"})
            
    except Exception as e:
        print(f"Unexpected error in upload_file: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": f"Server error: {str(e)}"})


def download_file(request, file_path):
    """Download a specific file from the data directory."""
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Download request for: {file_path}, client: {client_id}")
    
    # For containerized deployment, always use bundled data path
    data_path = "/app/data"
    
    # Optional: Try to get client config but don't require it
    try:
        client_config = ClientConfig.objects.get(client_id=client_id)
        config_dict = read_config_file(client_config.config_path)
        if "input_data_path" in config_dict and config_dict["input_data_path"]:
            data_path = config_dict["input_data_path"]
    except (ClientConfig.DoesNotExist, FileNotFoundError, json.JSONDecodeError):
        pass  # Use default bundled data path
    
    # Handle the 'root/' prefix that frontend adds
    if file_path.startswith('root/'):
        file_path = file_path[5:]  # Remove 'root/' prefix
        print(f"Removed root prefix, actual path: {file_path}")
    
    # Construct full file path
    full_file_path = os.path.join(data_path, file_path)
    print(f"Looking for file at: {full_file_path}")
    print(f"File exists: {os.path.exists(full_file_path)}")
    
    # Security check: ensure the file is within the data directory
    if not os.path.abspath(full_file_path).startswith(os.path.abspath(data_path)):
        print(f"Security violation: {full_file_path} not within {data_path}")
        return JsonResponse({"success": False, "error": "Access denied"}, status=403)
    
    if not os.path.exists(full_file_path) or not os.path.isfile(full_file_path):
        return JsonResponse({"success": False, "error": "File not found"}, status=404)
    
    try:
        # Determine content type
        import mimetypes
        content_type, _ = mimetypes.guess_type(full_file_path)
        if content_type is None:
            content_type = 'application/octet-stream'
        
        # Create response with file
        response = HttpResponse(content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
        
        with open(full_file_path, 'rb') as f:
            response.write(f.read())
        
        return response
    except Exception as e:
        return JsonResponse({"success": False, "error": f"Failed to download file: {str(e)}"}, status=500)


from django.utils.timezone import now
from django.conf import settings
from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
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
    else:
        print(f"Unknown action: {action}")
        return JsonResponse({"error", f"No handler for action {action}"})


def validate_input_data_path(p):
    if not os.path.exists(p):
        return {"success": False, "error": "Path does not exist"}
    if "modelspec.xlsx" in os.listdir(p):
        return {"success": True}
    else:
        return {"success": False, "error": "Path is not a valid SiteOpt Data path."}


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


def fetch_input_data(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Client {client_id} requesting input files")
    
    # For containerized deployment, always use bundled data path
    data_path = "/app/data"
    print(f"Using bundled data path: {data_path}")
    
    # Optional: Try to get client config but don't require it
    try:
        if client_id:
            config = get_client_config(client_id)
            config_d = read_config_file(config.config_path)
            if "input_data_path" in config_d and config_d["input_data_path"]:
                data_path = config_d["input_data_path"]
                print(f"Using client-specific data path: {data_path}")
    except Exception:
        print("No client config found, using default bundled data path")
    
    # Validate that data path exists and build file tree
    if os.path.exists(data_path):
        try:
            validation_result = validate_input_data_path(data_path)
            if validation_result["success"]:
                # Build the file tree
                excluded_dirs = [os.path.join(data_path, ".git")]
                tree = build_tree(data_path, excluded_dirs)
                # Add success field and title for frontend compatibility
                tree["success"] = True
                tree["title"] = f"Input Data ({os.path.basename(data_path)})"
                response = JsonResponse(tree)
            else:
                response = JsonResponse({"success": False, "error": f"Data validation failed: {validation_result.get('error', 'Unknown error')}"})
        except Exception as e:
            print(f"Error processing data path {data_path}: {str(e)}")
            import traceback
            traceback.print_exc()
            response = JsonResponse({"success": False, "error": f"Error accessing data: {str(e)}"})
    else:
        response = JsonResponse({"success": False, "error": f"Data path {data_path} does not exist"})
    
    return response


def fetch_data(request, folder, fname):
    # Get the client's configured data path
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    print(f"Fetch data request: folder={folder}, file={fname}, client={client_id}")
    
    # For containerized deployment, always use bundled data path
    data_path = "/app/data"
    
    # Optional: Try to get client config but don't require it
    try:
        if client_id:
            config = get_client_config(client_id)
            config_d = read_config_file(config.config_path)
            if "input_data_path" in config_d and config_d["input_data_path"]:
                data_path = config_d["input_data_path"]
    except Exception:
        pass  # Use default bundled data path
    
    # Build file path
    if folder == "root":
        p = os.path.join(data_path, fname)
    else:
        p = os.path.join(data_path, folder, fname)
    
    print(f"Looking for data file: {p}")
    
    if not os.path.exists(p):
        return HttpResponse(json.dumps({"error": f"File not found: {p}"}), content_type="application/json")
    
    try:
        if p.endswith(".xlsx"):
            wb = openpyxl.load_workbook(p)
            json_data = read_excel_as_json(wb)
            return HttpResponse(json_data, content_type="application/json")
        elif p.endswith(".csv"):
            json_data = read_csv_as_json(p)
            return HttpResponse(json_data, content_type="application/json")
        else:
            return HttpResponse(json.dumps({"error": f"Sending file {p} not implemented"}), content_type="application/json")
            
    except Exception as e:
        print(f"Error processing file {p}: {e}")
        import traceback
        traceback.print_exc()
        return HttpResponse(json.dumps({"error": f"Error processing file: {str(e)}"}), content_type="application/json")


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


def make_dir(p):
    """Create directory if it doesn't exist.

    Args:
        p: Absolute path to wanted dir

    Raises:
        OSError if operation failed.
    """
    os.makedirs(p, exist_ok=True)


def make_config_file(p):
    """Creates a default config file with bundled data path.

    Args:
        p (str): Full path to config file
    """
    # Default to bundled data path in container
    default_data_path = "/app/data"
    d = {"input_data_path": default_data_path,
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


def frontend_static(request, path):
    """Serve static files from the frontend dist directory."""
    from django.conf import settings
    from django.http import FileResponse, Http404
    import mimetypes
    
    static_file_path = os.path.join(settings.BASE_DIR, 'siteoptapp', 'frontend', 'dist', 'vite-assets', path)
    
    if os.path.exists(static_file_path) and os.path.isfile(static_file_path):
        content_type, _ = mimetypes.guess_type(static_file_path)
        return FileResponse(open(static_file_path, 'rb'), content_type=content_type)
    else:
        raise Http404("Static file not found")


def static_file_handler(request, path):
    """Serve static files from the staticfiles directory."""
    from django.conf import settings
    from django.http import FileResponse, Http404
    import mimetypes
    
    static_file_path = os.path.join(settings.STATIC_ROOT, path)
    
    if os.path.exists(static_file_path) and os.path.isfile(static_file_path):
        content_type, _ = mimetypes.guess_type(static_file_path)
        return FileResponse(open(static_file_path, 'rb'), content_type=content_type)
    else:
        raise Http404("Static file not found")


def config_js(request):
    """Serve runtime configuration for the frontend."""
    # Auto-detect API base from reverse proxy headers or use empty string for same-origin
    script_name = request.META.get('HTTP_X_SCRIPT_NAME', '').rstrip('/')
    api_base = script_name if script_name else ''
    
    config_content = f"""
// Runtime configuration injected by Django
window.__APP_CONFIG__ = {{
    API_BASE: '{api_base}'
}};
"""
    return HttpResponse(config_content, content_type='application/javascript')


def frontend_view(request):
    """Serve the Vue.js frontend index.html for all non-API routes."""
    from django.conf import settings
    try:
        with open(os.path.join(settings.BASE_DIR, 'siteoptapp', 'frontend', 'dist', 'index.html'), 'r') as f:
            return HttpResponse(f.read(), content_type='text/html')
    except FileNotFoundError:
        return HttpResponse("Frontend not built. Please run 'npm run build' in the frontend directory.", status=500)
