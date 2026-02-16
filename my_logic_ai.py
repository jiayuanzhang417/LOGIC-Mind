import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import openai
import time

app = Flask(__name__)
CORS(app)

openai.api_key = "Your api key here"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
@app.route('/data.json', methods=['GET'])
def get_data():
    if not os.path.exists(DATA_FILE) or os.stat(DATA_FILE).st_size == 0:
        return jsonify({"nodes": [], "edges": []})
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    except:
        return jsonify({"nodes": [], "edges": []})

@app.route('/save_logic', methods=['POST'])
def save_logic():
    try:
        data = request.json
        target_filename = data.get('filename')
        custom_title = data.get('title') 
        
        history_dir = os.path.join(BASE_DIR, 'history')
        
        if target_filename:

            path = os.path.join(history_dir, target_filename)
            
            if not custom_title and os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                    custom_title = old_data.get('title')
        else:
            timestamp = int(time.time())
            target_filename = f"logic_{timestamp}.json"
            if not custom_title:
                custom_title = f"Manual Save {time.strftime('%H:%M:%S')}"
        save_package = {
            "title": custom_title or target_filename,
            "nodes": data.get('nodes', []),
            "edges": data.get('edges', [])
        }
        os.makedirs(history_dir, exist_ok=True)
        with open(os.path.join(history_dir, target_filename), 'w', encoding='utf-8') as f:
            json.dump(save_package, f, ensure_ascii=False, indent=2)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(save_package, f, ensure_ascii=False, indent=2)

        return jsonify({"status": "success", "filename": target_filename})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route('/list_history', methods=['GET'])
def list_history():
    history_dir = os.path.join(BASE_DIR, 'history')
    if not os.path.exists(history_dir): return jsonify([])
    
    files = [f for f in os.listdir(history_dir) if f.endswith('.json')]
    files.sort(reverse=True)
    
    res = []
    for f in files:
        try:
            with open(os.path.join(history_dir, f), 'r', encoding='utf-8') as jf:
                data = json.load(jf)
                res.append({
                    "id": f.replace('logic_', '').replace('.json', ''),
                    "title": data.get('title', f),
                    "filename": f
                })
        except: continue
    return jsonify(res)
@app.route('/rename_history', methods=['POST'])
def rename_history():
    try:
        data = request.json
        filename = data.get('filename')
        new_title = data.get('new_title')
        
        if not filename or not new_title:
            return jsonify({"status": "error", "message": "Missing data"}), 400

        path = os.path.join(BASE_DIR, 'history', filename)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                content = json.load(f)
            
            content['title'] = new_title
            
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "File not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/load_history/<filename>', methods=['GET'])
def load_history(filename):
    history_path = os.path.join(BASE_DIR, 'history', filename)
    if os.path.exists(history_path):
        with open(history_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({"error": "File not found"}), 404

@app.route('/delete_history/<filename>', methods=['DELETE'])
def delete_history(filename):
    try:
        if ".." in filename or not filename.endswith(".json"):
            return jsonify({"status": "error", "message": "Invalid filename"}), 400
            
        history_path = os.path.join(BASE_DIR, 'history', filename)
        if os.path.exists(history_path):
            os.remove(history_path)
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": "File not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/generate_logic', methods=['POST'])
def generate_logic():
    try:
        user_input = request.json.get('prompt', '')
        if not user_input:
            user_input = request.json.get('text', '')
        if not user_input:
            return jsonify({"status": "error", "message": "No input"}), 400
        prompt = f"""Analyze the logic: '{user_input}'. 
Return ONLY a valid JSON object. 
Strictly follow this standard Cytoscape.js schema:
{{
  "nodes": [
    {{ "data": {{ "id": "n1", "label": "Node Name", "color": "#00d2ff", "textColor": "#ffffff", "shape": "ellipse" }} }}
  ],
  "edges": [
    {{ "data": {{ 
        "id": "e1", 
        "source": "n1", 
        "target": "n2", 
        "relationship": "action_name", 
        "color": "#00ffcc", 
        "curveStyle": "bezier", 
        "textColor": "#ffffff" 
    }} }}
  ]
}}
IMPORTANT: 
1. Use "relationship" field for edge text.
2. Edge color MUST be "#00ffcc" and curveStyle MUST be "bezier".
3. Do not include any markdown code blocks (like ```json) or any conversational text.
"""
        
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs logic maps in structured JSON format."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" }
        )
        
        content = response.choices[0].message.content.strip()
        
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
        
        ai_data = json.loads(content)
        for node in ai_data.get('nodes', []):
            if 'data' in node:
                node['data'].setdefault('color', '#00d2ff')
                node['data'].setdefault('textColor', '#ffffff')
                node['data'].setdefault('shape', 'ellipse')
        
        for edge in ai_data.get('edges', []):
            if 'data' in edge:
                if 'label' in edge['data'] and 'relationship' not in edge['data']:
                    edge['data']['relationship'] = edge['data']['label']
                edge['data'].setdefault('relationship', 'link')
                edge['data'].setdefault('color', '#00ffcc')
                edge['data'].setdefault('curveStyle', 'bezier')
                edge['data'].setdefault('textColor', '#ffffff')
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(ai_data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
            
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"AI Error Trace: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
if __name__ == '__main__':
    print(f"Server starting... Data file at: {DATA_FILE}")
    app.run(debug=True, port=5000)
