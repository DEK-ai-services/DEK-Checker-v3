from flask import Blueprint, render_template, request, jsonify, current_app, Response, stream_with_context, send_from_directory
from ...models import GoogleSheet, SheetData, GptResponse, GptResponseVersion
from sqlalchemy.future import select
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import joinedload, selectinload
from ...utils.gpt_utils import analyze_products
from ...utils.error_handlers import log_error, log_info, log_debug, log_warning
from datetime import datetime
from openai import OpenAI
import json
import os


@gpt.route('/save_gpt_response', methods=['POST'])
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


@gpt.route('/update_gpt_response_status', methods=['POST'])
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


@gpt.route('/get_last_responses', methods=['GET'])
async def get_last_responses():

    """
    Načtou se záznamy z tabulky GptResponse, které odpovídají daným parametrům - jsou ve stavu 'pending', a jsou seřazeny podle data analýzy sestupně
    Záznamy jsou rozděleny na stránky podle parametrů page a per_page
    Záznam obsahuje informace o jednotlivých odpovědích, včetně verze odpovědi, vylepšeného textu, změn a dalších informací o analýze
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


@gpt.route('/get_gpt_responses', methods=['GET'])
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


@gpt.route('/analyze', methods=['POST', 'GET'])
def analyze():

    """
    Uvnitř těla tohoto endpointu je definován generátor generate(), který streamuje výsledky analýzy
        - uvnitř těla generátoru se volá funkce analyze_products()
            - Definovaná v utils/gpt_utils.py
            - Tato funkce nejdříve získá data z Google sheets (pomocí funkce get_sheet_data())
            - Poté pro tyto data zavolá funkci analyze_with_assistant()
                - Tato funkce vytvoří instanci klienta OpenAI pomocí API klíče uloženého v config souboru aplikace
                - Vytvoří se nové vlákno (thread) - sloužící jako kontejner pro zprávy, které budou součástí interakce
                - Do vlákna se přidá zpráva, která obsahuje název produktu a text, který má být analyzován
                - Asistent se spustí na nově vytvořeném vlákně - samotný proces analýzi
                - Funkce neustále kontroluje stav analýzy (zda úspěšně doběhla nebo skončila s chybou)
                - Po dokončení analýzy získá funkce poslední zprávu odeslanou asistentem
                - Tato zpráva je přeparsovaná do JSONu a odeslaná v odpovědi
    Endpoint využívá streamovanou odpověď pomocí funkce Response(), která postupně posílá data klientovi v reálném čase, místo toho, aby poslal všechna data najednou po jejich kompletním zpracování 
    """

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


@gpt.route('/analyze_text', methods=['POST'])
def analyze_text():

    """
    Tento endpoint slouží pro provedení textové analýzy s využitím asistenta OpenAI
    Přijímá text, který má být analyzován a ID assistenta, který má analýzu provést
    Endpoint vrací výsledek analýzy
    """

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