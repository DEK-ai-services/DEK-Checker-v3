from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import config
from .utils.error_handlers import setup_logging, register_error_handlers, log_info, log_error

db = SQLAlchemy()

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)

    setup_logging(app)
    register_error_handlers(app)

    from .main import main
    app.register_blueprint(main)

    return app