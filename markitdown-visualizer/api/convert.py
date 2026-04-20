import json
import os
import sys
import tempfile
import subprocess
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs
import cgi
import io

# Add local packages to path (installed by vercel.json installCommand)
LOCAL_PACKAGE_PATH = os.path.join(os.path.dirname(__file__), '.python-packages')
if LOCAL_PACKAGE_PATH not in sys.path:
    sys.path.insert(0, LOCAL_PACKAGE_PATH)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            
            # Parse multipart form data
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self._send_json_response(400, {'error': 'Content-Type must be multipart/form-data'})
                return
            
            # Get content length
            content_length = int(self.headers.get('Content-Length', 0))
            
            # Read the body
            body = self.rfile.read(content_length)
            
            # Parse multipart data
            environ = {
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': content_type,
                'CONTENT_LENGTH': str(content_length),
            }
            
            fp = io.BytesIO(body)
            form = cgi.FieldStorage(fp=fp, environ=environ, keep_blank_values=True)
            
            # Get file from form
            if 'file' not in form:
                self._send_json_response(400, {'error': 'No file provided'})
                return
            
            file_item = form['file']
            if not file_item.filename:
                self._send_json_response(400, {'error': 'No file provided'})
                return
            
            filename = file_item.filename
            file_content = file_item.file.read()
            
            # Create temp directory and save file
            with tempfile.TemporaryDirectory() as temp_dir:
                input_path = os.path.join(temp_dir, filename)
                with open(input_path, 'wb') as f:
                    f.write(file_content)
                
                # Run markitdown with PYTHONPATH set
                env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'}
                env['PYTHONPATH'] = LOCAL_PACKAGE_PATH + ':' + env.get('PYTHONPATH', '')
                
                result = subprocess.run(
                    [sys.executable, '-m', 'markitdown', input_path],
                    capture_output=True,
                    text=True,
                    env=env
                )
                
                if result.returncode != 0:
                    self._send_json_response(500, {'error': f'Conversion failed: {result.stderr}'})
                    return
                
                response = {
                    'success': True,
                    'markdown': result.stdout,
                    'fileName': filename
                }
                
                self._send_json_response(200, response)
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            self._send_json_response(500, {'error': str(e)})
    
    def _send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
