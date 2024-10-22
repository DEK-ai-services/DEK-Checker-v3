from flask import current_app
from .error_handlers import log_error, log_info, log_debug, log_warning
from openai import OpenAI
import json
from .sheet_utils import get_sheet_data


def analyze_with_assistant(product_name, text_to_analyze, assistant_id):
    client = OpenAI(api_key=current_app.config['OPENAI_API_KEY'])

    try:
        log_info(f"Starting analysis for product: {product_name} using assistant: {assistant_id}")

        thread = client.beta.threads.create()
        log_debug(f"Created thread: {thread.id}")

        client.beta.threads.messages.create(
            thread_id=thread.id,
            role="user",
            content=f"Product Name: {product_name}\nDescription: {text_to_analyze}"
        )
        log_debug("Added message to thread")

        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=assistant_id
        )
        log_debug(f"Started run: {run.id}")

        while True:
            run = client.beta.threads.runs.retrieve(thread_id=thread.id, run_id=run.id)
            if run.status == "completed":
                log_info("Analysis completed")
                break
            elif run.status == "failed":
                log_error("Analysis failed")
                raise Exception("Analysis failed")

        messages = client.beta.threads.messages.list(thread_id=thread.id)
        last_message = next(msg for msg in reversed(messages.data) if msg.role == "assistant")
        content = last_message.content[0].text.value
        
        parsed_content = json.loads(content)
        
        return {
            "status": "completed",
            "product_name": parsed_content['product_name'],
            "product_description": parsed_content['product_description'],
            "statistics": parsed_content.get('statistics', {})
        }

    except json.JSONDecodeError as e:
        log_error(f"JSON parsing error in assistant analysis: {str(e)}")
        return {
            "status": "error",
            "message": f"Error parsing JSON response: {str(e)}",
            "raw_content": content
        }
    except Exception as e:
        log_error(f"Error in assistant analysis: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"An error occurred during analysis: {str(e)}"
        }


def analyze_products(sheet_id, product_name_column, analysis_column, assistant_id):
    df, _, _, _ = get_sheet_data(sheet_id)
    
    for index, row in df.iterrows():
        product_name = row[product_name_column]
        text_to_analyze = row[analysis_column]
        
        result = analyze_with_assistant(product_name, text_to_analyze, assistant_id)
        if result is not None:
            result['row_index'] = index
            yield result
        else:
            log_error(f"Analyze_with_assistant returned None for product: {product_name}")
            yield {
                "status": "error",
                "message": f"Analysis failed for product: {product_name}",
                "row_index": index
            }