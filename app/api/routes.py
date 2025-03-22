from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from werkzeug.utils import secure_filename
from app.utils.file_processor import process_file, save_processed_data
from app.utils.document_analyzer import generate_summary, get_answer
import glob

api = Blueprint('api', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@api.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and initial processing"""
    if 'file' not in request.files:
        print("No file part in the request")
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        print("No file selected")
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        if file and allowed_file(file.filename):
            # Create a unique filename
            file_id = str(uuid.uuid4())
            filename = secure_filename(file.filename)
            ext = os.path.splitext(filename)[1].lower()
            new_filename = f"{file_id}{ext}"
            
            # Save the file
            upload_folder = current_app.config['UPLOAD_FOLDER']
            file_path = os.path.join(upload_folder, new_filename)
            file.save(file_path)
            
            # Process the file based on its type
            processed_data = process_file(file_path)
            
            # Save processed data
            save_processed_data(file_id, processed_data)
            
            # Return success response with the file ID for future reference
            return jsonify({
                'file_id': file_id,  # Use consistent snake_case for field names
                'message': 'File uploaded and processed successfully',
                'filename': filename
            }), 200
        else:
            print(f"File type not allowed: {file.filename}")
            return jsonify({'error': 'File type not allowed'}), 400
    except Exception as e:
        print(f"Error uploading file: {str(e)}")
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
    """Ask a question about the document content"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Handle both camelCase and snake_case parameter names
    question = data.get('question')
    file_id = data.get('file_id') or data.get('fileId')
    page_id = data.get('page_id') or data.get('pageId')
    
    print(f"Ask question request data: {data}")
    
    if not question:
        return jsonify({'error': 'Question is required'}), 400
    
    if not file_id:
        return jsonify({'error': 'file_id is required'}), 400
    
    try:
        # Log the question for debugging
        print(f"Question asked: '{question}' for file {file_id}, page {page_id}")
        
        # Get answer using the current page for better context
        answer = get_answer(question, file_id, page_id)
        
        return jsonify({
            'answer': answer
        }), 200
    except Exception as e:
        print(f"Error processing question: {str(e)}")
        return jsonify({'error': 'Error processing your question'}), 500

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