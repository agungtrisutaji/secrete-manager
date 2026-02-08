import json
import os
import sys

# Add current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app.main import app
    from app.core.config import get_settings
    settings = get_settings()
except ImportError as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

def json_to_markdown(openapi_data):
    md = f"# {openapi_data.get('openapi', '')} API Documentation\n\n"
    info = openapi_data.get('info', {})
    md += f"# {info.get('title', 'API')}\n\n"
    md += f"**Version:** {info.get('version', '1.0.0')}\n\n"
    md += f"{info.get('description', '')}\n\n"

    md += "## Endpoints\n\n"

    paths = openapi_data.get('paths', {})
    for path, methods in paths.items():
        for method, details in methods.items():
            method_upper = method.upper()
            summary = details.get('summary', 'No summary')
            description = details.get('description', '')
            
            md += f"### {method_upper} {path}\n\n"
            md += f"**{summary}**\n\n"
            if description:
                md += f"{description}\n\n"

            # Parameters
            params = details.get('parameters', [])
            if params:
                md += "#### Parameters\n\n"
                md += "| Name | In | Required | Description | Schema |\n"
                md += "|------|----|----------|-------------|--------|\n"
                for p in params:
                    name = p.get('name', '')
                    loc = p.get('in', '')
                    req = "Yes" if p.get('required') else "No"
                    desc = p.get('description', '-')
                    schema = p.get('schema', {}).get('type', 'string')
                    md += f"| {name} | {loc} | {req} | {desc} | {schema} |\n"
                md += "\n"

            # Request Body
            req_body = details.get('requestBody', {})
            if req_body:
                content = req_body.get('content', {})
                json_content = content.get('application/json', {})
                if json_content:
                    schema_ref = json_content.get('schema', {}).get('$ref')
                    if schema_ref:
                        model_name = schema_ref.split('/')[-1]
                        md += f"#### Request Body\n\nType: `{model_name}`\n\n"

            # Responses
            responses = details.get('responses', {})
            if responses:
                md += "#### Responses\n\n"
                md += "| Code | Description |\n"
                md += "|------|-------------|\n"
                for code, resp in responses.items():
                    desc = resp.get('description', '')
                    md += f"| {code} | {desc} |\n"
                md += "\n"
            
            md += "---\n\n"
    
    return md

def export_openapi():
    # Force settings to have debug=True so docs are generated if they depend on it
    # (Though in main.py docs_url handles the conditional logic, app.openapi() usually works if app is initialized)
    
    print("Generating OpenAPI schema...")
    openapi_data = app.openapi()
    
    # Export JSON
    json_file = "openapi.json"
    with open(json_file, "w") as f:
        json.dump(openapi_data, f, indent=2)
    print(f"✅ OpenAPI JSON exported to: {os.path.abspath(json_file)}")

    # Export Markdown
    print("Generating Markdown documentation...")
    markdown_content = json_to_markdown(openapi_data)
    md_file = "api_docs.md"
    with open(md_file, "w") as f:
        f.write(markdown_content)
    print(f"✅ OpenAPI Markdown exported to: {os.path.abspath(md_file)}")

if __name__ == "__main__":
    export_openapi()
