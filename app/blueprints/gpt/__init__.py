from flask import Blueprint

gpt = Blueprint('gpt', __name__)

from . import routes