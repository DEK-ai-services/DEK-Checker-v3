from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import config
from .utils.error_handlers import setup_logging, register_error_handlers

db = SQLAlchemy()

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)

    setup_logging(app)
    register_error_handlers(app)

    from .blueprints.main import main
    from .blueprints.gpt import gpt
    from .blueprints.sheets import sheets
    app.register_blueprint(main)
    app.register_blueprint(gpt)
    app.register_blueprint(sheets)

    return app