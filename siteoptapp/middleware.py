"""
Middleware to auto-detect reverse proxy URL prefix and serve dynamic frontend config
"""
import json
import os
import uuid
from django.http import HttpResponse
from django.conf import settings
class ReverseProxyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.detected_script_name = ''  # Cache the detected script name

    def __call__(self, request):
        # Auto-detect script name from reverse proxy headers or URL path
        script_name = ''
        
        # Check common reverse proxy headers
        if 'HTTP_X_SCRIPT_NAME' in request.META:
            script_name = request.META['HTTP_X_SCRIPT_NAME']
        elif 'HTTP_X_FORWARDED_PREFIX' in request.META:
            script_name = request.META['HTTP_X_FORWARDED_PREFIX']
        else:
            # Try to detect from HTTP_REFERER header
            referer = request.META.get('HTTP_REFERER', '')
            if '/container/' in referer:
                # Extract from referer like https://elexia.amct.pl/container/3a834290734a/#/
                import re
                match = re.search(r'/container/([a-f0-9]+)', referer)
                if match:
                    container_id = match.group(1)
                    script_name = f'/container/{container_id}'
                    self.detected_script_name = script_name  # Cache it
            
            if not script_name:
                # Auto-detect from full request path including the original URL
                full_path = request.get_full_path()
                request_uri = request.META.get('REQUEST_URI', full_path)
                
                # Check if we're behind a reverse proxy with /container/ prefix
                if '/container/' in request_uri:
                    # Extract container prefix from REQUEST_URI like /container/a0f157527f3a/api/health/
                    parts = request_uri.split('/')
                    for i, part in enumerate(parts):
                        if part == 'container' and i + 1 < len(parts):
                            script_name = f'/container/{parts[i + 1]}'
                            self.detected_script_name = script_name  # Cache it
                            break
                elif request.path_info.startswith('/container/'):
                    # Fallback: Auto-detect from URL path like /container/eeb91870a5e4/api/health/
                    parts = request.path_info.split('/')
                    if len(parts) >= 3 and parts[1] == 'container':
                        script_name = f'/container/{parts[2]}'
                        self.detected_script_name = script_name  # Cache it
                elif self.detected_script_name:
                    # Use previously detected script name if available
                    script_name = self.detected_script_name
        
        # Set the script name and adjust path_info for Django routing
        if script_name:
            request.META['SCRIPT_NAME'] = script_name
            # Strip the script name from path_info so Django can route correctly
            if request.path_info.startswith(script_name):
                request.path_info = request.path_info[len(script_name):]
                # Ensure path_info starts with /
                if not request.path_info.startswith('/'):
                    request.path_info = '/' + request.path_info
                    
        # Handle dynamic config.js serving
        if request.path_info == '/config.js':
            return self.serve_config_js(script_name)
        
        # Temporarily set SCRIPT_NAME in the environment for this request
        # This helps Django generate correct URLs
        old_script_name = os.environ.get('SCRIPT_NAME', '')
        if script_name:
            os.environ['SCRIPT_NAME'] = script_name
            
        # Ensure client has a proper UUID client_id BEFORE processing the request
        client_id = request.COOKIES.get('client_id')
        if not client_id:
            # Generate a new UUID for this client and add it to the request
            client_id = str(uuid.uuid4())
            # Add to request.COOKIES so views can access it immediately
            request.COOKIES['client_id'] = client_id
            print(f"Generated new client_id: {client_id}")

        try:
            response = self.get_response(request)
            
            # Set the client_id cookie for future requests if it was newly generated
            if not request.COOKIES.get('client_id') or client_id != request.COOKIES.get('client_id'):
                response.set_cookie('client_id', client_id, max_age=30*24*60*60)  # 30 days
        finally:
            # Restore original SCRIPT_NAME
            if old_script_name:
                os.environ['SCRIPT_NAME'] = old_script_name
            elif 'SCRIPT_NAME' in os.environ:
                del os.environ['SCRIPT_NAME']
                
        return response

    def serve_config_js(self, script_name=''):
        """Serve dynamic configuration for frontend"""
        # Ensure script_name ends with a slash for proper URL construction
        api_base = script_name
        if script_name and not script_name.endswith('/'):
            api_base = script_name + '/'
        elif not script_name:
            api_base = '/'
            
        config = {
            'API_BASE': api_base,
            'BASE_PATH': f'{script_name}/' if script_name else '/'
        }
        
        js_content = f"""window.__APP_CONFIG__ = {json.dumps(config)};"""
        
        return HttpResponse(
            js_content,
            content_type='application/javascript',
            headers={'Cache-Control': 'no-cache, no-store, must-revalidate'}
        )
    

