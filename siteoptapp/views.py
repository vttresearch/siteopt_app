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


# Work Folder Management

import shutil
from siteoptapp.models import WorkFolder

def get_work_folder_base_path(client_id):
    """Get the base path for work folders for a given client."""
    base = platformdirs.user_data_dir()
    return os.path.abspath(os.path.join(base, "siteopt-app", "work", str(client_id)[:6]))


@ensure_csrf_cookie
def list_work_folders(request):
    """List all work folders for the current client."""
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    
    if not client_id:
        return JsonResponse({"success": False, "error": "Client ID required"})
    
    try:
        from siteoptapp.models import ClientConfig
        client_config = ClientConfig.objects.get(client_id=client_id)
        work_folders = WorkFolder.objects.filter(client=client_config).order_by('-created_at')
        
        folders_data = []
        for folder in work_folders:
            folders_data.append({
                "id": folder.id,
                "name": folder.name,
                "path": folder.path,
                "created_from": folder.created_from,
                "created_at": folder.created_at.isoformat(),
                "exists": os.path.exists(folder.path)
            })
        
        return JsonResponse({"success": True, "folders": folders_data})
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": True, "folders": []})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)})


@csrf_protect
def create_work_folder(request):
    """Create a new work folder."""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "POST method required"})
    
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    
    if not client_id:
        return JsonResponse({"success": False, "error": "Client ID required"})
    
    try:
        data = json.loads(request.body.decode("utf-8"))
        folder_name = data.get("name", "").strip()
        source_type = data.get("source_type", "new")  # 'new', 'input_data', or 'work_folder'
        source_id = data.get("source_id")  # For cloning from another work folder
        
        if not folder_name:
            return JsonResponse({"success": False, "error": "Folder name is required"})
        
        # Get or create client config
        from siteoptapp.models import ClientConfig
        try:
            client_config = ClientConfig.objects.get(client_id=client_id)
        except ClientConfig.DoesNotExist:
            from django.utils.timezone import now
            base = platformdirs.user_data_dir()
            config_file_dir = os.path.abspath(os.path.join(base, "siteopt-app", "settings", str(client_id)[:6]))
            config_file_path = os.path.join(config_file_dir, "config.json")
            os.makedirs(config_file_dir, exist_ok=True)
            
            # Create default config file
            with open(config_file_path, "w") as fp:
                json.dump({"input_data_path": "", "project_data_path": "", "work_folders": {}}, fp, indent=4)
            
            client_config = ClientConfig.objects.create(
                client_id=client_id,
                config_path=config_file_path,
                last_seen=now()
            )
        
        # Check if folder name already exists
        if WorkFolder.objects.filter(client=client_config, name=folder_name).exists():
            return JsonResponse({"success": False, "error": f"Work folder '{folder_name}' already exists"})
        
        # Create work folder path
        base_path = get_work_folder_base_path(client_id)
        folder_path = os.path.join(base_path, folder_name)
        
        # Create the directory
        os.makedirs(folder_path, exist_ok=True)
        
        # Copy data based on source type
        if source_type == "input_data":
            # Copy from input data path
            data_path = "/app/data"  # Default bundled data
            try:
                config_dict = read_config_file(client_config.config_path)
                if "input_data_path" in config_dict and config_dict["input_data_path"]:
                    data_path = config_dict["input_data_path"]
            except:
                pass
            
            if os.path.exists(data_path):
                shutil.copytree(data_path, folder_path, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
        
        elif source_type == "work_folder" and source_id:
            # Clone from another work folder
            try:
                source_folder = WorkFolder.objects.get(id=source_id, client=client_config)
                if os.path.exists(source_folder.path):
                    shutil.copytree(source_folder.path, folder_path, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git"))
                else:
                    return JsonResponse({"success": False, "error": "Source work folder path does not exist"})
            except WorkFolder.DoesNotExist:
                return JsonResponse({"success": False, "error": "Source work folder not found"})
        
        # Create database record
        work_folder = WorkFolder.objects.create(
            client=client_config,
            name=folder_name,
            path=folder_path,
            created_from=source_type if source_type != "work_folder" else f"work_folder_{source_id}"
        )
        
        return JsonResponse({
            "success": True,
            "folder": {
                "id": work_folder.id,
                "name": work_folder.name,
                "path": work_folder.path,
                "created_from": work_folder.created_from,
                "created_at": work_folder.created_at.isoformat()
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_protect
def delete_work_folder(request, folder_id):
    """Delete a work folder."""
    if request.method != 'DELETE':
        return JsonResponse({"success": False, "error": "DELETE method required"})
    
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    
    if not client_id:
        return JsonResponse({"success": False, "error": "Client ID required"})
    
    try:
        from siteoptapp.models import ClientConfig
        client_config = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client_config)
        
        # Delete the physical folder
        if os.path.exists(work_folder.path):
            shutil.rmtree(work_folder.path)
        
        # Delete the database record
        work_folder.delete()
        
        return JsonResponse({"success": True, "message": "Work folder deleted"})
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@ensure_csrf_cookie
def fetch_work_folder_tree(request, folder_id):
    """Get file tree for a specific work folder."""
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    
    if not client_id:
        return JsonResponse({"success": False, "error": "Client ID required"})
    
    try:
        from siteoptapp.models import ClientConfig
        client_config = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client_config)
        
        if not os.path.exists(work_folder.path):
            return JsonResponse({"success": False, "error": "Work folder path does not exist"})
        
        def build_tree(path, exclude_dirs=None):
            exclude_dirs = set(os.path.abspath(d) for d in (exclude_dirs or []))
            tree = {"children": []}
            try:
                entries = os.listdir(path)
                # Sort: directories first, then files
                entries.sort(key=lambda e: (os.path.isfile(os.path.join(path, e)), e.lower()))
                
                for entry in entries:
                    full_path = os.path.join(path, entry)
                    abs_path = os.path.abspath(full_path)
                    
                    if abs_path in exclude_dirs:
                        continue
                    
                    if os.path.isdir(full_path):
                        tree["children"].append({
                            "name": entry,
                            "type": "folder",
                            "children": build_tree(full_path, exclude_dirs)["children"]
                        })
                    else:
                        tree["children"].append({
                            "name": entry,
                            "type": "file"
                        })
            except PermissionError:
                pass
            
            return tree
        
        excluded_dirs = [os.path.join(work_folder.path, ".git"), os.path.join(work_folder.path, "__pycache__")]
        tree = build_tree(work_folder.path, excluded_dirs)
        tree["name"] = work_folder.name
        tree["title"] = work_folder.name
        
        return JsonResponse({"success": True, "tree": tree})
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@ensure_csrf_cookie
def fetch_work_folder_file(request, folder_id, file_path):
    """Fetch a file from a work folder."""
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    
    if not client_id:
        return JsonResponse({"success": False, "error": "Client ID required"})
    
    try:
        from siteoptapp.models import ClientConfig
        client_config = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client_config)
        
        # Build full file path
        full_file_path = os.path.join(work_folder.path, file_path)
        
        # Security check: ensure the path is within the work folder
        if not os.path.abspath(full_file_path).startswith(os.path.abspath(work_folder.path)):
            return JsonResponse({"success": False, "error": "Invalid file path"})
        
        if not os.path.exists(full_file_path):
            return JsonResponse({"success": False, "error": f"File not found: {file_path}"})
        
        # Read and return file data based on type
        if full_file_path.endswith('.xlsx'):
            wb = openpyxl.load_workbook(full_file_path)
            json_data = read_excel_as_json(wb)
            return HttpResponse(json_data, content_type="application/json")
        elif full_file_path.endswith('.csv'):
            json_data = read_csv_as_json(full_file_path)
            return HttpResponse(json_data, content_type="application/json")
        else:
            _, ext = os.path.splitext(full_file_path)
            return HttpResponse(json.dumps({"error": f"Reading files with extension '{ext}' not implemented"}), content_type="application/json")
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_exempt
def upload_work_folder_file(request, folder_id):
    """Upload a file to a work folder"""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "Only POST requests allowed"})
    
    try:
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        if 'file' not in request.FILES:
            return JsonResponse({"success": False, "error": "No file provided"})
        
        uploaded_file = request.FILES['file']
        folder_path = request.POST.get('folder_path', '')
        
        # Construct target path
        target_dir = os.path.join(work_folder.path, folder_path) if folder_path else work_folder.path
        
        # Security check: ensure target is within work folder
        target_dir = os.path.normpath(target_dir)
        if not target_dir.startswith(os.path.normpath(work_folder.path)):
            return JsonResponse({"success": False, "error": "Invalid path"})
        
        # Create directory if needed
        os.makedirs(target_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(target_dir, uploaded_file.name)
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        
        return JsonResponse({"success": True, "filename": uploaded_file.name})
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


def download_work_folder_file(request, folder_id, file_path):
    """Download a file from a work folder"""
    try:
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        # Construct full file path
        full_file_path = os.path.join(work_folder.path, file_path)
        
        # Security check: ensure file is within work folder
        full_file_path = os.path.normpath(full_file_path)
        if not full_file_path.startswith(os.path.normpath(work_folder.path)):
            return JsonResponse({"success": False, "error": "Invalid file path"})
        
        if not os.path.exists(full_file_path):
            return JsonResponse({"success": False, "error": "File not found"})
        
        if not os.path.isfile(full_file_path):
            return JsonResponse({"success": False, "error": "Path is not a file"})
        
        # Read file and return as attachment
        with open(full_file_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/octet-stream')
            response['Content-Disposition'] = f'attachment; filename="{os.path.basename(full_file_path)}"'
            return response
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


def download_work_folder_zip(request, folder_id):
    """Download entire work folder as a zip file"""
    try:
        import zipfile
        import tempfile
        
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        # Create a temporary zip file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        temp_zip_path = temp_zip.name
        temp_zip.close()
        
        try:
            # Create zip file
            with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Walk through the work folder
                for root, dirs, files in os.walk(work_folder.path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        # Calculate archive name (relative to work folder)
                        arcname = os.path.relpath(file_path, work_folder.path)
                        zipf.write(file_path, arcname)
            
            # Read the zip file and return it
            with open(temp_zip_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/zip')
                response['Content-Disposition'] = f'attachment; filename="{work_folder.name}.zip"'
                return response
        finally:
            # Clean up temporary file
            if os.path.exists(temp_zip_path):
                os.unlink(temp_zip_path)
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_exempt
def upload_work_folder_zip(request, folder_id):
    """Upload and extract a zip file to a work folder"""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "Only POST requests allowed"})
    
    try:
        import zipfile
        
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        if 'file' not in request.FILES:
            return JsonResponse({"success": False, "error": "No file provided"})
        
        uploaded_file = request.FILES['file']
        
        # Check if it's a zip file
        if not uploaded_file.name.endswith('.zip'):
            return JsonResponse({"success": False, "error": "Only zip files are supported"})
        
        # Save to temporary location
        import tempfile
        import shutil
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        for chunk in uploaded_file.chunks():
            temp_zip.write(chunk)
        temp_zip.close()
        
        try:
            # Validate zip file first
            with zipfile.ZipFile(temp_zip.name, 'r') as zipf:
                # Security check: ensure all files extract within work folder
                for member in zipf.namelist():
                    member_path = os.path.join(work_folder.path, member)
                    member_path = os.path.normpath(member_path)
                    if not member_path.startswith(os.path.normpath(work_folder.path)):
                        return JsonResponse({"success": False, "error": f"Invalid path in zip: {member}"})
            
            # Remove old contents
            for item in os.listdir(work_folder.path):
                item_path = os.path.join(work_folder.path, item)
                if os.path.isfile(item_path):
                    os.unlink(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
            
            # Extract zip file to work folder
            with zipfile.ZipFile(temp_zip.name, 'r') as zipf:
                zipf.extractall(work_folder.path)
            
            return JsonResponse({"success": True, "message": "Zip file extracted successfully"})
        finally:
            # Clean up temporary file
            if os.path.exists(temp_zip.name):
                os.unlink(temp_zip.name)
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except zipfile.BadZipFile:
        return JsonResponse({"success": False, "error": "Invalid zip file"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_exempt
def clear_work_folder(request, folder_id):
    """Clear all contents from a work folder"""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "Only POST requests allowed"})
    
    try:
        import shutil
        
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        # Remove all contents
        for item in os.listdir(work_folder.path):
            item_path = os.path.join(work_folder.path, item)
            if os.path.isfile(item_path):
                os.unlink(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        
        return JsonResponse({"success": True})
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_exempt
def save_work_folder_file(request, folder_id):
    """Save edited data to a work folder file"""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "Only POST requests allowed"})
    
    try:
        import json
        client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
        if not client_id:
            return JsonResponse({"success": False, "error": "Client ID required"})
        
        client = ClientConfig.objects.get(client_id=client_id)
        work_folder = WorkFolder.objects.get(id=folder_id, client=client)
        
        body = json.loads(request.body)
        file_path = body.get('file_path', '')
        data = body.get('data')
        sheet = body.get('sheet')
        
        if not file_path:
            return JsonResponse({"success": False, "error": "File path required"})
        
        # Construct full file path
        full_file_path = os.path.join(work_folder.path, file_path)
        
        # Security check: ensure file is within work folder
        full_file_path = os.path.normpath(full_file_path)
        if not full_file_path.startswith(os.path.normpath(work_folder.path)):
            return JsonResponse({"success": False, "error": "Invalid file path"})
        
        # Log for debugging
        print(f"Saving file: {full_file_path}")
        print(f"File exists: {os.path.exists(full_file_path)}")
        print(f"Data type: {type(data)}, Data length: {len(data) if data else 0}")
        
        # Save based on file type
        if full_file_path.endswith('.csv'):
            import csv
            with open(full_file_path, 'w', newline='', encoding='utf-8') as f:
                if data and len(data) > 0:
                    writer = csv.DictWriter(f, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
        elif full_file_path.endswith('.xlsx'):
            wb = openpyxl.Workbook() if not os.path.exists(full_file_path) else openpyxl.load_workbook(full_file_path)
            
            # If sheet specified, update that sheet
            if sheet:
                if sheet in wb.sheetnames:
                    ws = wb[sheet]
                    ws.delete_rows(1, ws.max_row)
                else:
                    ws = wb.create_sheet(sheet)
            else:
                ws = wb.active
            
            # Write data
            if data and len(data) > 0:
                headers = list(data[0].keys())
                ws.append(headers)
                for row in data:
                    ws.append([row.get(h) for h in headers])
            
            wb.save(full_file_path)
        else:
            return JsonResponse({"success": False, "error": "Unsupported file type"})
        
        return JsonResponse({"success": True})
        
    except ClientConfig.DoesNotExist:
        return JsonResponse({"success": False, "error": "Client not found"})
    except WorkFolder.DoesNotExist:
        return JsonResponse({"success": False, "error": "Work folder not found"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})


@csrf_exempt
def save_data_file(request):
    """Save edited data to a data folder file"""
    if request.method != 'POST':
        return JsonResponse({"success": False, "error": "Only POST requests allowed"})
    
    try:
        import json
        body = json.loads(request.body)
        file_path = body.get('file_path', '')
        data = body.get('data')
        sheet = body.get('sheet')
        
        if not file_path:
            return JsonResponse({"success": False, "error": "File path required"})
        
        # Construct full file path (relative to /app/data)
        data_dir = "/app/data"
        full_file_path = os.path.join(data_dir, file_path)
        
        # Security check: ensure file is within data directory
        full_file_path = os.path.normpath(full_file_path)
        if not full_file_path.startswith(os.path.normpath(data_dir)):
            return JsonResponse({"success": False, "error": "Invalid file path"})
        
        # Log for debugging
        print(f"Saving file: {full_file_path}")
        print(f"File exists: {os.path.exists(full_file_path)}")
        print(f"Data type: {type(data)}, Data length: {len(data) if data else 0}")
        
        # Save based on file type
        if full_file_path.endswith('.csv'):
            import csv
            with open(full_file_path, 'w', newline='', encoding='utf-8') as f:
                if data and len(data) > 0:
                    writer = csv.DictWriter(f, fieldnames=data[0].keys())
                    writer.writeheader()
                    writer.writerows(data)
        elif full_file_path.endswith('.xlsx'):
            wb = openpyxl.Workbook() if not os.path.exists(full_file_path) else openpyxl.load_workbook(full_file_path)
            
            # If sheet specified, update that sheet
            if sheet:
                if sheet in wb.sheetnames:
                    ws = wb[sheet]
                    ws.delete_rows(1, ws.max_row)
                else:
                    ws = wb.create_sheet(sheet)
            else:
                ws = wb.active
            
            # Write data
            if data and len(data) > 0:
                headers = list(data[0].keys())
                ws.append(headers)
                for row in data:
                    ws.append([row.get(h) for h in headers])
            
            wb.save(full_file_path)
        else:
            return JsonResponse({"success": False, "error": "Unsupported file type"})
        
        return JsonResponse({"success": True})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"success": False, "error": str(e)})
