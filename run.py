from os import environ
from app import create_app,db
from flask_migrate import Migrate
from app.models import *
from asgiref.wsgi import WsgiToAsgi
import uvicorn

app = create_app(environ.get('FLASK_CONFIG'))
migrate = Migrate(app,db)

# adaptér sloužící pro ASGI (asynchronní běh aplikace)
asgi_app = WsgiToAsgi(app)

if __name__ == "__main__":
    uvicorn.run(asgi_app, host="127.0.0.1", port=5000)