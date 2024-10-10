from . import main
from ..models import *
from re import sub
import os
import json



def clean_text(text):
    # Nahrazení značek <change> jejich obsahem
    text = sub(r'<change[^>]*>(.*?)</change>', r'\1', text)
    
    # Odstranění dalších HTML značek, pokud existují
    text = sub(r'<[^>]*>', '', text)
    
    # Odstranění nadbytečných mezer
    text = sub(r'\s+', ' ', text).strip()
    
    return text


@main.route('/')
def index():
    log_debug("Rendering index page")
    return render_template('index.html')


@main.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'favicon.ico', 
        mimetype='image/vnd.microsoft.icon'
    )