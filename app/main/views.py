from flask import Blueprint, render_template, request, jsonify, current_app, Response, stream_with_context, send_from_directory
from .models import GoogleSheet, SheetData, GptResponse, GptResponseVersion
from sqlalchemy.future import select
from sqlalchemy import and_, desc, func
from .utils.sheet_utils import get_sheet_data, update_google_sheet
from datetime import datetime
from .utils.gpt_utils import analyze_products, process_with_new_prompt, analyze_text_with_assistant
from .utils.error_handlers import log_error, log_info, log_debug, log_warning
from config import Config
from sqlalchemy import desc
from sqlalchemy.orm import joinedload
import json
import re
import os
from sqlalchemy.orm import selectinload
from openai import OpenAI

# main = Blueprint('main', __name__) 

def clean_text(text):
    # Nahrazení značek <change> jejich obsahem
    text = re.sub(r'<change[^>]*>(.*?)</change>', r'\1', text)
    
    # Odstranění dalších HTML značek, pokud existují
    text = re.sub(r'<[^>]*>', '', text)
    
    # Odstranění nadbytečných mezer
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

@main.route('/')
def index():
    log_debug("Rendering index page")
    return render_template('index.html')

@main.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'favicon.ico', 
        mimetype='image/vnd.microsoft.icon'
    )


@main.route('/save_gpt_response', methods=['POST'])
async def save_gpt_response():

    """
    Kontrola sheet_id:
        Pokud v requestu chybí sheet_id, metoda vrátí odpověď s kódem 400 a chybovou zprávou.
        Pokud je sheet_id přítomný, provede se dotaz na tabulku GoogleSheet, aby se ověřilo, zda tato tabulka existuje v databázi.
        Pokud Google Sheet s daným sheet_id neexistuje, vrátí se odpověď s kódem 404 a chybovou zprávou.
    
    Vytvoření a uložení záznamu GptResponse:
        Pokud Google Sheet existuje, vytvoří se nový záznam GptResponse, který zahrnuje detaily analýzy (např. produktový název, původní text a další).
        Tento záznam je přidán do databázové session a po zavolání session.flush() je připraven pro trvalé uložení.
    
    Vytvoření verze odpovědi (GptResponseVersion):
        Následně je vytvořena verze odpovědi (GptResponseVersion), která obsahuje verzi textu generovaného GPT, včetně popisu změn a promptu.
        Tento záznam je rovněž přidán do session.
    
    Jakmile jsou oba záznamy (odpověď a její verze) přidány, změny jsou trvale uloženy do databáze pomocí session.commit().
    """

    data = request.json
    log_info(f"Received data for saving GPT response: {data}")
    
    async with current_app.async_session() as session:
        if 'sheet_id' not in data:
            log_error("Missing sheet_id in request data")
            return jsonify({'status': 'error', 'message': 'Missing sheet_id in request data'}), 400

        google_sheet = await session.execute(select(GoogleSheet).filter_by(sheet_id=data['sheet_id']))
        google_sheet = google_sheet.scalar_one_or_none()
        
        if not google_sheet:
            log_error(f"Google Sheet not found for sheet_id: {data['sheet_id']}")
            return jsonify({'status': 'error', 'message': 'Google Sheet not found'}), 404

        gpt_response = GptResponse(
            google_sheet_id=google_sheet.id,
            product_name=data['product_name'],
            product_name_column=data.get('product_name_column', ''),
            analysis_column=data.get('analysis_column', ''),
            assistant_id=data.get('assistant_id', ''),
            original_text=data['original_text'],
            analysis_date=datetime.utcnow(),
            status='pending'
        )
        session.add(gpt_response)
        await session.flush()

        version = GptResponseVersion(
            gpt_response_id=gpt_response.id,
            version_number=1,
            improved_text=data['improved_text'],
            changes=json.dumps(data.get('changes', [])),
            prompt="Initial analysis"
        )
        session.add(version)
        await session.commit()
        
        log_info(f"GPT response saved successfully. ID: {gpt_response.id}")
    return jsonify({'status': 'success', 'message': 'GPT response saved', 'response_id': gpt_response.id})


@main.route('/update_gpt_response_status', methods=['POST'])
async def update_gpt_response_status():

    """
    Validace vstupních dat: Pokud response_id není uveden nebo status obsahuje neplatnou hodnotu, vrátí se chyba 400.
    Načtení odpovědi GPT: Na základě response_id se asynchronně načte odpověď GPT z databáze.
    Aktualizace stavu: Pokud odpověď existuje, její stav se aktualizuje na hodnotu uvedenou v požadavku a změny se uloží do databáze.
    """

    data = request.json
    response_id = data.get('response_id')
    new_status = data.get('status')
    
    print(f"Received update request: response_id={response_id}, new_status={new_status}")  # Debug log
    
    if not response_id or new_status not in ['confirmed', 'rejected']:
        print(f"Invalid data: response_id={response_id}, new_status={new_status}")  # Debug log
        return jsonify({'status': 'error', 'message': 'Invalid data'}), 400
    
    async with current_app.async_session() as session:
        gpt_response = await session.get(GptResponse, response_id)
        if gpt_response:
            gpt_response.status = new_status
            await session.commit()
            print(f"Successfully updated status for response_id={response_id} to {new_status}")  # Debug log
            return jsonify({'status': 'success', 'message': 'Status updated successfully'})
        else:
            print(f"GPT response not found for response_id={response_id}")  # Debug log
            return jsonify({'status': 'error', 'message': 'GPT response not found'}), 404


@main.route('/get_last_responses', methods=['GET'])
async def get_last_responses():

    """
    Načtou se odpovědi typu GptResponse, které odpovídají daným parametrům, jsou ve stavu 'pending', a jsou seřazeny podle data analýzy sestupně
    Odpovědi jsou rozděleny na stránky podle parametrů page a per_page
    Odpověď obsahuje informace o jednotlivých odpovědích, včetně verze odpovědi, vylepšeného textu, změn a dalších informací o analýze
    """

    sheet_id = request.args.get('sheet_id')
    product_name_column = request.args.get('product_name_column')
    analysis_column = request.args.get('analysis_column')
    assistant_id = request.args.get('assistant_id')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    if not all([sheet_id, product_name_column, analysis_column, assistant_id]):
        return jsonify({'status': 'error', 'message': 'Missing required parameters'}), 400

    try:
        async with current_app.async_session() as session:
            google_sheet = await session.execute(select(GoogleSheet).filter_by(sheet_id=sheet_id))
            google_sheet = google_sheet.scalar_one_or_none()
            
            if not google_sheet:
                return jsonify({'status': 'error', 'message': 'Sheet not found'}), 404

            query = select(GptResponse).filter(
                GptResponse.google_sheet_id == google_sheet.id,
                GptResponse.product_name_column == product_name_column,
                GptResponse.analysis_column == analysis_column,
                GptResponse.assistant_id == assistant_id,
                GptResponse.status == 'pending'
            ).order_by(desc(GptResponse.analysis_date))

            # Počítání celkového počtu záznamů
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar_one()

            # Aplikace stránkování
            paginated_query = query.offset((page - 1) * per_page).limit(per_page)
            result = await session.execute(paginated_query)
            responses = result.scalars().all()

            response_data = []
            for response in responses:
                versions_query = select(GptResponseVersion).filter_by(gpt_response_id=response.id).order_by(desc(GptResponseVersion.version_number))
                versions_result = await session.execute(versions_query)
                versions = versions_result.scalars().all()
                
                latest_version = versions[0] if versions else None
                
                response_data.append({
                    'id': response.id,
                    'product_name': {'original': response.product_name},
                    'product_description': {
                        'original': response.original_text,
                        'improved': latest_version.improved_text if latest_version else None,
                        'changes': json.loads(latest_version.changes) if latest_version else []
                    },
                    'analysis_date': response.analysis_date.isoformat(),
                    'versions': [
                        {
                            'version_number': version.version_number,
                            'improved_text': version.improved_text,
                            'changes': json.loads(version.changes),
                            'prompt': version.prompt,
                            'created_at': version.created_at.isoformat()
                        } for version in versions
                    ]
                })

        return jsonify({
            'status': 'success',
            'responses': response_data,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        })
    except Exception as e:
        log_error(f"Error getting last responses: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'Internal server error'}), 500


@main.route('/get-saved-sheets', methods=['GET'])
async def get_saved_sheets():
    """
    Vrací seznam všech uložených záznamů z tabulky GoogleSheet ve formátu JSON
    """
    try:
        async with current_app.async_session() as session:
            result = await session.execute(select(GoogleSheet))
            sheets = result.scalars().all()
        return jsonify([{
            'id': sheet.id, 
            'sheet_id': sheet.sheet_id, 
            'name': sheet.name, 
            'url': sheet.url
        } for sheet in sheets])
    except Exception as e:
        log_error(f"Chyba při načítání uložených tabulek: {str(e)}", exc_info=True)
        return jsonify({'error': 'Omlouváme se, ale nepodařilo se načíst uložené tabulky. Zkuste to prosím znovu později.'}), 500

    
@main.route('/get_gpt_responses', methods=['GET'])
async def get_gpt_responses():

    """
    Načítá všechny položky z tabulky GptResponse včetně jejich verzí z tabulky GptResponseVersion a vrací je v podobě strukturovaného JSON
    """

    log_info("Fetching GPT responses for backlog")
    async with current_app.async_session() as session:
        result = await session.execute(select(GptResponse).order_by(GptResponse.analysis_date.desc()))
        responses = result.scalars().all()

        response_data = []
        for response in responses:
            versions = await session.execute(
                select(GptResponseVersion)
                .filter_by(gpt_response_id=response.id)
                .order_by(GptResponseVersion.version_number)
            )
            versions = versions.scalars().all()

            version_data = []
            for v in versions:
                try:
                    changes = json.loads(v.changes)
                except json.JSONDecodeError:
                    log_error(f"Invalid JSON in changes for version {v.version_number} of response {response.id}")
                    changes = []

                version_data.append({
                    'version_number': v.version_number,
                    'improved_text': v.improved_text,
                    'changes': changes,
                    'prompt': v.prompt,
                    'created_at': v.created_at.isoformat()
                })

            response_data.append({
                'id': response.id,
                'product_name': response.product_name,
                'original_text': response.original_text,
                'analysis_date': response.analysis_date.isoformat(),
                'versions': version_data
            })

    log_info(f"Fetched {len(response_data)} GPT responses for backlog")
    return jsonify({'status': 'success', 'responses': response_data})


@main.route('/add_sheet', methods=['POST'])
async def add_sheet():

    """
    Přidá nový záznam do tabulky GoogleSheet podle poskytnutého JSONu v POST requestu
    """

    try:
        data = request.json
        new_sheet = GoogleSheet(sheet_id=data['sheet_id'], name=data['name'], url=data['url'])
        async with current_app.async_session() as session:
            session.add(new_sheet)
            await session.commit()
        log_info(f"Nová tabulka přidána: {data['name']} ({data['sheet_id']})")
        return jsonify({'status': 'success', 'message': 'Tabulka byla úspěšně přidána.'})
    except Exception as e:
        log_error(f"Chyba při přidávání tabulky: {str(e)}", exc_info=True)
        return jsonify({'error': 'Omlouváme se, ale nepodařilo se přidat tabulku. Zkontrolujte prosím zadané údaje a zkuste to znovu.'}), 500


@main.route('/get_sheet_data', methods=['GET'])
def get_sheet_data_route():

    """
    Vrací data z tabulky podle zadaného sheet_id. 
    Odpověď obsahuje jak načtená data, tak další informace jako sloupce, varování a datum poslední aktualizace
    Volá funkci get_sheet_data()
        - Definovaná v utils/sheet_utils.py
        - Funkce načítá data z Google Sheets

    """

    sheet_id = request.args.get('sheet_id')
    try:
        log_info(f"Načítání dat tabulky pro sheet_id: {sheet_id}")
        df, _, warning, last_updated = get_sheet_data(sheet_id)
        log_info(f"Data tabulky úspěšně načtena. Rozměry: {df.shape}")

        return jsonify({
            'status': 'success',
            'data': df.to_dict('records'),
            'columns': df.columns.tolist(),
            'warning': warning,
            'last_updated': last_updated.isoformat() if last_updated else None
        })
    except Exception as e:
        log_error(f"Chyba při načítání dat tabulky pro {sheet_id}: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'Omlouváme se, ale nepodařilo se načíst data tabulky. Zkontrolujte prosím připojení a zkuste to znovu.'}), 500
    

@main.route('/update_sheet_data', methods=['POST'])
async def update_sheet_data():
    try:
        data = request.json
        sheet_id = data.get('sheet_id')
        row_index = data.get('row_index')
        column_name = data.get('column_name')
        new_value = clean_text(data.get('new_value', ''))

        await update_google_sheet(sheet_id, row_index, column_name, new_value)

        async with current_app.async_session() as session:
            google_sheet = await session.execute(select(GoogleSheet).filter_by(sheet_id=sheet_id))
            google_sheet = google_sheet.scalar_one_or_none()
            
            if google_sheet:
                sheet_data = await session.execute(
                    select(SheetData).filter_by(
                        google_sheet_id=google_sheet.id,
                        row_index=row_index,
                        column_name=column_name
                    )
                )
                sheet_data = sheet_data.scalar_one_or_none()

                if sheet_data:
                    sheet_data.data = new_value
                    sheet_data.last_updated = datetime.utcnow()
                else:
                    new_sheet_data = SheetData(
                        google_sheet_id=google_sheet.id,
                        row_index=row_index,
                        column_name=column_name,
                        data=new_value
                    )
                    session.add(new_sheet_data)

                await session.commit()

        return jsonify({'status': 'success', 'message': 'Data byla úspěšně aktualizována.'})
    except Exception as e:
        log_error(f"Chyba při aktualizaci dat tabulky: {str(e)}", exc_info=True)
        return jsonify({'error': f'Omlouváme se, ale nepodařilo se aktualizovat data: {str(e)}'}), 500

@main.route('/get_assistants', methods=['GET'])
def get_assistants():
    assistants = current_app.config['OPENAI_ASSISTANTS']
    return jsonify(list(assistants.items()))

@main.route('/save_feedback', methods=['POST'])
async def save_feedback():
    try:
        data = request.json
        result = data['result']
        feedback = data['feedback']

        async with current_app.async_session() as session:
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


@main.route('/analyze', methods=['POST', 'GET'])
def analyze():
    try:
        if request.method == 'POST':
            data = request.json
        else:
            data = request.args

        sheet_id = data.get('sheet_id')
        product_name_column = data.get('product_name_column')
        analysis_column = data.get('analysis_column')
        assistant_id = data.get('assistant_id')

        if not all([sheet_id, product_name_column, analysis_column, assistant_id]):
            log_warning("Incomplete parameters for analysis")
            return jsonify({'error': 'Prosím, vyplňte všechny požadované parametry pro analýzu.'}), 400

        log_info(f"Starting analysis for sheet_id: {sheet_id}")

        def generate():
            try:
                for result in analyze_products(sheet_id, product_name_column, analysis_column, assistant_id):
                    if result['status'] == 'error':
                        log_error(f"Error during analysis: {result['message']}")
                        if 'raw_content' in result:
                            log_error(f"Raw content: {result['raw_content']}")
                    yield f"data: {json.dumps(result)}\n\n"
                yield "event: done\ndata: Analysis completed successfully\n\n"
            except Exception as e:
                log_error(f"Error during analysis: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'status': 'error', 'message': 'An error occurred during analysis. Please try again.'})}\n\n"
            finally:
                log_info(f"Analysis completed for sheet_id: {sheet_id}")

        return Response(stream_with_context(generate()), content_type='text/event-stream')

    except Exception as e:
        log_error(f"Error in analysis for sheet {sheet_id}: {str(e)}", exc_info=True)
        return jsonify({'error': 'We apologize, but the analysis could not be performed. Please check the parameters and try again.'}), 500


@main.route('/analyze_text', methods=['POST'])
def analyze_text():
    data = request.json
    text = data.get('text')
    assistant_id = data.get('assistant_id')

    if not text or not assistant_id:
        return jsonify({'error': 'Chybí text nebo ID asistenta'}), 400

    client = OpenAI(api_key=Config.OPENAI_API_KEY)

    try:
        thread = client.beta.threads.create()

        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Analyze and correct this text, marking changes with XML tags: {text}"
        )

        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant_id
        )

        while True:
            run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
            if run.status == "completed":
                break

        messages = client.beta.threads.messages.list(thread_id=thread.id)
        last_message = next(msg for msg in reversed(messages.data) if msg.role == "assistant")
        analysis = last_message.content[0].text.value

        return jsonify({
            "improved_text": analysis
        })

    except Exception as e:
        log_error(f"Error in analyze_text: {str(e)}")
        return jsonify({'error': str(e)}), 500