from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from werkzeug.utils import secure_filename
from app.utils.file_processor import process_file
from app.utils.document_analyzer import generate_summary, get_answer

api = Blueprint('api', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@api.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload"""
    try:
        if 'file' not in request.files:
            print("Error: No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            print("Error: No selected file")
            return jsonify({'error': 'No selected file'}), 400
        
        if file and allowed_file(file.filename):
            # Generate unique filename
            original_filename = secure_filename(file.filename)
            file_ext = original_filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{str(uuid.uuid4())}.{file_ext}"
            
            # Save file
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            print(f"Saving file to: {file_path}")
            file.save(file_path)
            
            # Start processing in background (in a real app, this would be async)
            file_info = {
                'id': unique_filename.split('.')[0],
                'original_name': original_filename,
                'path': file_path,
                'type': file_ext
            }
            
            # Process file synchronously for hackathon (would be async in production)
            print(f"Processing file: {file_info}")
            process_result = process_file(file_info)
            print(f"Process result: {process_result}")
            
            return jsonify({
                'message': 'File uploaded successfully',
                'file_id': file_info['id'],
                'status': 'processing' if process_result else 'error'
            }), 200
        
        print(f"Error: File type not allowed - {file.filename}")
        return jsonify({'error': 'File type not allowed'}), 400
    except Exception as e:
        import traceback
        print(f"Error in upload_file: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@api.route('/analyze/<file_id>', methods=['POST'])
def analyze_file(file_id):
    """Trigger analysis of an uploaded file"""
    # In a real app, this would check if file exists in database
    # and start a background job if not already processed
    
    # For hackathon, we'll assume the file is already processed in the upload step
    return jsonify({
        'status': 'processing',
        'message': 'Analysis started'
    }), 200

@api.route('/summaries/<file_id>', methods=['GET'])
def get_summaries(file_id):
    """Get summaries for a file"""
    import os
    import json
    import tempfile
    
    # Try to load the processed data from temporary storage
    temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
    file_path = os.path.join(temp_dir, f"{file_id}.json")
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                return jsonify(json.load(f)), 200
        except Exception as e:
            print(f"Error loading file data: {str(e)}")
    
    # If we couldn't load the data, return dummy data
    return jsonify({
        'pages': [
            {
                'page_number': 1,
                'text': 'Sample extracted text from page 1...',
                'summary': 'This is a summary of page 1.',
                'notes': ''
            },
            {
                'page_number': 2,
                'text': 'Sample extracted text from page 2...',
                'summary': 'This is a summary of page 2.',
                'notes': ''
            }
        ]
    }), 200

@api.route('/ask', methods=['POST'])
def ask_question():
    """Handle Q&A about documents"""
    data = request.json
    
    if not data or 'question' not in data or 'fileId' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    question = data['question']
    file_id = data['fileId']
    page_id = data.get('pageId')  # Optional
    
    # TODO: Implement actual Q&A
    answer = get_answer(question, file_id, page_id)
    
    return jsonify({
        'answer': answer,
        'references': ['Reference to page 1', 'Reference to page 2']
    }), 200

@api.route('/notes/<page_id>', methods=['PUT'])
def update_notes(page_id):
    """Update user notes for a page"""
    data = request.json
    
    if not data or 'userNotes' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    user_notes = data['userNotes']
    
    # TODO: Save notes to database
    
    return jsonify({
        'status': 'success',
        'message': 'Notes updated successfully'
    }), 200 