"""Flask configuration"""

from os import environ, path
from dotenv import load_dotenv

# Specifikování `.evn` souboru obsahujícího key/value config hodnoty
basedir = path.abspath(path.dirname(__file__))
load_dotenv(path.join(basedir,'.env'))

class Config:
    """Set Flask config variables."""
    OPENAI_API_KEY = environ.get('OPENAI_API_KEY')
    GOOGLE_SHEETS_CREDENTIALS_FILE = path.join(basedir,'dekchecker3-0-67d427b19f19.json')

    SQLALCHEMY_DATABASE_URI = f'postgresql://{environ.get('DB_USER')}:{environ.get('DB_USER_PASS')}@localhost/{environ.get('DB_NAME')}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    OPENAI_ASSISTANTS = {
        'Kontrola gramatiky': environ.get('KONTROLA_GRAMATIKY'),
        'Guru': environ.get('GURU'),  
        'Český korektor': environ.get('CZ_KOREKTOR'),
    }



class ProdConfig(Config):
    """Config variables for production"""
    FLASK_DEBUG = False
    FLASK_ENV = "production"


class DevConfig(Config):
    """Config variables for development"""
    FLASK_DEBUG = True
    FLASK_ENV = "development"


config = {
    'development': DevConfig,
    'production': ProdConfig,
}