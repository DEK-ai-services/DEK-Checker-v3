from flask import Flask, g
from flask_sqlalchemy import SQLAlchemy
from config import config
from .utils.error_handlers import setup_logging, register_error_handlers
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

db = SQLAlchemy()

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    db.init_app(app)

    # Vytvoření asynchronního databázového enginu
    async_engine = create_async_engine(app.config['SQLALCHEMY_DATABASE_URI_ASYNC'])

    # Vytvoření asynchronní session
    async_session = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

    # Před každým požadavkem vytvoříme asynchronní session
    @app.before_request
    async def create_session():
        g.async_session = async_session()

    # Po každém požadavku session uzavřeme
    @app.teardown_request
    async def remove_session(exception=None):
        session = g.pop("async_session",None)
        if session is not None:
            await session.close()

    setup_logging(app)
    register_error_handlers(app)

    from .blueprints.main import main
    from .blueprints.gpt import gpt
    from .blueprints.sheets import sheets
    app.register_blueprint(main)
    app.register_blueprint(gpt)
    app.register_blueprint(sheets)

    return app