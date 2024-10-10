import logging
from logging.handlers import RotatingFileHandler
import os
from flask import jsonify, current_app
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)

def setup_logging(app):
    """
    Set up logging for the application.
    
    Args:
        app (Flask): The Flask application instance.
    """
    log_dir = os.path.join(app.root_path, 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_file = os.path.join(log_dir, 'app.log')
    
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    file_handler = RotatingFileHandler(log_file, maxBytes=10240000, backupCount=10)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.DEBUG)
    
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.DEBUG)
    
    # If we're in production, set the log level to INFO
    if not app.debug:
        app.logger.setLevel(logging.INFO)

    global logger
    logger = app.logger

def handle_error(e):
    """
    Generic error handler for all exceptions.
    
    Args:
        e (Exception): The exception that was raised.
    
    Returns:
        tuple: A tuple containing a JSON response and an HTTP status code.
    """
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    logger.error(f"An error occurred: {str(e)}", exc_info=True)
    return jsonify(error=str(e)), code

def register_error_handlers(app):
    """
    Register error handlers for the application.
    
    Args:
        app (Flask): The Flask application instance.
    """
    app.register_error_handler(Exception, handle_error)

def log_debug(message):
    """
    Log a debug message.
    
    Args:
        message (str): The debug message to log.
    """
    logger.debug(message)

def log_info(message):
    """
    Log an info message.
    
    Args:
        message (str): The info message to log.
    """
    logger.info(message)

def log_warning(message):
    """
    Log a warning message.
    
    Args:
        message (str): The warning message to log.
    """
    logger.warning(message)

def log_error(message, exc_info=False):
    """
    Log an error message.
    
    Args:
        message (str): The error message to log.
        exc_info (bool, optional): Whether to include exception info in the log. Defaults to False.
    """
    logger.error(message, exc_info=exc_info)