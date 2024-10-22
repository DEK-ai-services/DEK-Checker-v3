import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
import pandas as pd
from sqlalchemy.future import select
from flask import current_app
from cachetools import TTLCache
from .error_handlers import log_error, log_info, log_debug, log_warning
from ..models import GoogleSheet, SheetData
from datetime import datetime

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
CHUNK_SIZE = 1000  # Number of rows to fetch in each request
cache = TTLCache(maxsize=100, ttl=300)  # Cache for 5 minutes

def get_credentials():
    service_account_path = os.path.join(current_app.root_path, 'utils', 'dekchecker3-0-80a4d5fa1c92.json')
    return service_account.Credentials.from_service_account_file(service_account_path, scopes=SCOPES)


def get_sheet_data(sheet_id, range_name='A1:ZZ'):
    cache_key = f"{sheet_id}:{range_name}"
    if cache_key in cache:
        log_info(f"Returning cached data for sheet {sheet_id}")
        return cache[cache_key]

    creds = get_credentials()
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()
    
    log_info(f"Fetching data for sheet {sheet_id}")
    
    metadata = sheet.get(spreadsheetId=sheet_id, fields='sheets.properties').execute()
    sheet_properties = metadata['sheets'][0]['properties']
    total_rows = sheet_properties['gridProperties']['rowCount']
    total_columns = sheet_properties['gridProperties']['columnCount']

    all_values = []
    for start_row in range(1, total_rows, CHUNK_SIZE):
        end_row = min(start_row + CHUNK_SIZE - 1, total_rows)
        chunk_range = f'A{start_row}:ZZ{end_row}'
        
        log_debug(f"Fetching chunk {chunk_range} for sheet {sheet_id}")
        
        result = sheet.values().get(spreadsheetId=sheet_id, range=chunk_range).execute()
        
        chunk_values = result.get('values', [])
        all_values.extend(chunk_values)

        if len(chunk_values) < CHUNK_SIZE:
            break  # We've reached the end of the data

    if not all_values:
        log_warning(f'No data found in the sheet {sheet_id}')
        return pd.DataFrame(), {}, '', None

    # Pad rows with empty strings if necessary
    max_cols = max(len(row) for row in all_values)
    padded_values = [row + [''] * (max_cols - len(row)) for row in all_values]

    df = pd.DataFrame(padded_values[1:], columns=padded_values[0])
    df = df.dropna(axis=1, how='all')  # Remove completely empty columns


    if "číslo položky" in df.columns.lower():
        warning = "Sloupec 'Číslo položky' nebyl nalezen v tabulce."
    else:
        warning = ""

    result = (df, {col: idx for idx, col in enumerate(df.columns)}, warning, datetime.now())
    cache[cache_key] = result
    
    log_info(f"Fetched and processed data for sheet {sheet_id}")
    
    return result


async def update_google_sheet(sheet_id, row_index, column_name, new_value):
    try:
        log_info(f"Starting Google Sheet update for sheet_id: {sheet_id}, row: {row_index}, column: {column_name}")
        creds = get_credentials()
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        
        log_debug("Fetching sheet properties")
        result = sheet.get(spreadsheetId=sheet_id).execute()
        sheet_properties = result['sheets'][0]['properties']
        sheet_title = sheet_properties['title']
        
        log_debug("Fetching all column names")
        header_range = f'{sheet_title}!A1:ZZ1'
        header_result = sheet.values().get(spreadsheetId=sheet_id, range=header_range).execute()
        headers = header_result.get('values', [[]])[0]
        log_debug(f"Total columns found: {len(headers)}")
        
        if not column_name:
            log_error("Column name is empty")
            raise ValueError("Column name is empty")
        
        if column_name not in headers:
            log_error(f"Column '{column_name}' not found in sheet headers. Available columns: {', '.join(headers)}")
            raise ValueError(f"Column '{column_name}' not found in sheet headers. Available columns: {', '.join(headers)}")
        
        column_index = headers.index(column_name) + 1
        log_debug(f"Column index for '{column_name}': {column_index}")
        
        column_letter = get_column_letter(column_index)
        update_range = f'{sheet_title}!{column_letter}{row_index + 2}'
        log_debug(f"Update range: {update_range}")
        
        body = {
            'values': [[new_value]]
        }
        
        log_info("Sending update request to Google Sheets API")
        sheet.values().update(
            spreadsheetId=sheet_id,
            range=update_range,
            valueInputOption='RAW',
            body=body
        ).execute()
        log_info("Google Sheet update completed successfully")
    except Exception as e:
        log_error(f"Error in update_google_sheet: {str(e)}", exc_info=True)
        raise

def get_column_letter(index):
    """Convert a column index to a column letter (e.g., 1 = A, 27 = AA)"""
    result = ""
    while index > 0:
        index -= 1
        result = chr(65 + (index % 26)) + result
        index //= 26
    return result