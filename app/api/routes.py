from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from werkzeug.utils import secure_filename
from app.utils.file_processor import process_file
from app.utils.document_analyzer import generate_summary, get_answer
import glob

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
    from flask import current_app, url_for
    
    # Try to load the processed data from temporary storage
    temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
    file_path = os.path.join(temp_dir, f"{file_id}.json")
    
    # Look for the original file
    upload_folder = current_app.config['UPLOAD_FOLDER']
    original_files = glob.glob(os.path.join(upload_folder, f"{file_id}.*"))
    original_file_path = original_files[0] if original_files else None
    
    if original_file_path:
        file_type = os.path.splitext(original_file_path)[1].lower()[1:]  # Get extension without dot
        # Make the path relative to static folder for serving
        relative_path = os.path.relpath(original_file_path, os.path.join(current_app.root_path, 'static'))
        file_url = f"/static/{relative_path}"
        
        # Add direct URL for downloading
        download_url = f"/static/{relative_path}"
        
        # For PDF files, we might want to convert pages to images (future enhancement)
        pdf_page_images = []
        if file_type == 'pdf':
            # In a production app, we'd extract and save images for each page
            # For this MVP, we'll just provide the PDF URL directly
            pass
    else:
        file_type = "unknown"
        file_url = None
        download_url = None
        pdf_page_images = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                # Add file information
                data['file_type'] = file_type
                data['file_url'] = file_url
                data['download_url'] = download_url
                data['pdf_page_images'] = pdf_page_images
                return jsonify(data), 200
        except Exception as e:
            print(f"Error loading file data: {str(e)}")
    
    # If we couldn't load the data, return dummy data
    return jsonify({
        'file_type': file_type,
        'file_url': file_url,
        'download_url': download_url,
        'pdf_page_images': pdf_page_images,
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