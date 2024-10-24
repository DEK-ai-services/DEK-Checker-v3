from flask import Blueprint, render_template, request, jsonify, g, Response, send_from_directory
from . import main
from ...models import GoogleSheet, SheetData, GptResponse, GptResponseVersion
from sqlalchemy.future import select
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import joinedload, selectinload
from ...utils.error_handlers import log_error, log_info, log_debug, log_warning
from datetime import datetime
from openai import OpenAI
import json
import os


@main.route('/')
def index():
    log_debug("Rendering index page")
    return render_template('index.html')


@main.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(g.root_path, 'static'),
        'favicon.ico', 
        mimetype='image/vnd.microsoft.icon'
    )


@main.route('/get_assistants', methods=['GET'])
def get_assistants():

    """
    Z configu aplikace získá seznam OPENAI asistentů
    """

    assistants = g.config['OPENAI_ASSISTANTS']
    return jsonify(list(assistants.items()))


@main.route('/save_feedback', methods=['POST'])
async def save_feedback():

    """
    Přidá položku do tabulky Feedback
    """

    try:
        data = request.json
        result = data['result']
        feedback = data['feedback']

        async with g.async_session as session:
            new_feedback = Feedback(
                gpt_response_id=result['id'],
                feedback_text=feedback,
                created_at=datetime.utcnow()
            )
            session.add(new_feedback)
            await session.commit()

        return jsonify({'status': 'success', 'message': 'Feedback byl úspěšně uložen'})
    except Exception as e:
        log_error(f"Chyba při ukládání feedbacku: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'Nepodařilo se uložit feedback'}), 500
