from flask import Blueprint, render_template, request, jsonify, current_app, Response, stream_with_context, send_from_directory
from . import sheets
from ...models import GoogleSheet, SheetData, GptResponse, GptResponseVersion
from sqlalchemy.future import select
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import joinedload, selectinload
from ...utils.sheet_utils import get_sheet_data, update_google_sheet
from ...utils.error_handlers import log_error, log_info, log_debug, log_warning
from datetime import datetime
from openai import OpenAI
import json
import re
import os


def clean_text(text):
    # Nahrazení značek <change> jejich obsahem
    text = re.sub(r'<change[^>]*>(.*?)</change>', r'\1', text)
    # Odstranění dalších HTML značek, pokud existují
    text = re.sub(r'<[^>]*>', '', text)
    # Odstranění nadbytečných mezer
    text = re.sub(r'\s+', ' ', text).strip() 
    return text


@sheets.route('/get-saved-sheets', methods=['GET'])
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


@sheets.route('/add_sheet', methods=['POST'])
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


@sheets.route('/get_sheet_data', methods=['GET'])
def get_sheet_data_route():

    """
    Volá funkci get_sheet_data()
        - Definovaná v utils/sheet_utils.py
        - Přijímá jeden argument "sheet_id", pomocí kterého získá data o tomto záznamu z Google sheets
        - Funkce vrací n-tici o 4 hodnotách:
            - df: Pandas DataFrame, který obsahuje data načtená z Google tabulky
            - _: slovník, který mapuje názvy sloupců na jejich indexy
            - warning: případné varování, které může být vytvořeno během načítání dat
            - last_updated: aktuální datum a čas, kdy byla funkce zavolána
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


@sheets.route('/update_sheet_data', methods=['POST'])
async def update_sheet_data():

    """
    Volá se asynchronní funkce update_google_sheet, která používá Google Sheets API k aktualizaci buňky
        - Definovaná v utils/sheet_utils.py
        - Získá názvy sloupců z tabulky, ověří, zda sloupec existuje.
        - Pokud sloupec existuje, vypočítá index sloupce a následně aktualizuje buňku na konkrétním řádku a sloupci pomocí Google Sheets API
    V databázi (v tabulce GoogleSheet) najdeme záznam, který odpovídá sheet_id v API callu
    Pokud tento záznam existuje vyhledáme záznam v tabulce SheetData s odpovídajícími vlastnostmi google_sheet_id, row_index, column_name z API callu
        - Pokud tento záznam existuje upravíme jeho vlastnost "data" na hodnotu "new_value" z API callu
        - Pokud tento záznam neexistuje vytvoříme v tabulce SheetData nový záznam, kde vlastnost "data" = "new_value" z API callu
    """

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