from os import environ
from app import create_app,db
from werkzeug.serving import run_simple
from flask_migrate import Migrate
from app.models import *

app = create_app(environ.get('FLASK_CONFIG'))
migrate = Migrate(app,db)

if __name__ == "__main__":
    run_simple('localhost', 5000, app, use_reloader=False, use_debugger=True)