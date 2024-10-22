from flask import Blueprint

sheets = Blueprint('sheets', __name__)

from . import routes