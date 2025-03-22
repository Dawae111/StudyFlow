from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from werkzeug.utils import secure_filename
from app.utils.file_processor import process_file, process_pdf, process_image, save_processed_data
from app.utils.document_analyzer import generate_summary, get_answer, get_available_models
import glob
import json
import tempfile

api = Blueprint('api', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



@api.route('/add-page', methods=['POST'])
def add_page():
    """Handles adding a new page to an existing document"""
    try:
        print("⭐ /add-page endpoint called")
        
        # Check for file in request
        if 'file' not in request.files:
            print("ERROR: No file part in request")
            return jsonify({'error': 'No file part', 'success': False}), 400
        
        # Get document ID from form data and sanitize it
        file = request.files['file']
        document_id = request.form.get('documentId', '')
        
        # Sanitize document_id to remove any path characters
        if '\\' in document_id or '/' in document_id:
            print(f"WARNING: Document ID contains path separators: {document_id}")
            # Extract just the filename portion
            document_id = os.path.basename(document_id)
            print(f"Sanitized document ID: {document_id}")
        
        print(f"⭐ Received request with document ID: {document_id}")

        if not document_id:
            print("ERROR: Missing document ID")
            return jsonify({'error': 'Missing document ID', 'success': False}), 400

        if file.filename == '':
            print("ERROR: No selected file")
            return jsonify({'error': 'No selected file', 'success': False}), 400
        
        # Check if file type is allowed
        if file and allowed_file(file.filename):
            # Generate a unique filename for the new page
            original_filename = secure_filename(file.filename)
            file_ext = original_filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{str(uuid.uuid4())}.{file_ext}"

            # Save the file in the upload directory
            upload_folder = current_app.config['UPLOAD_FOLDER']
            os.makedirs(upload_folder, exist_ok=True)  # Ensure upload folder exists
            
            file_path = os.path.join(upload_folder, unique_filename)
            print(f"Saving new page file to: {file_path}")
            file.save(file_path)

            # Try to find the document data in different possible locations
            document_file = None
            document_data = None
            
            # List of possible locations to check
            locations = [
                os.path.join(upload_folder, 'studyflow', f"{document_id}.json"),
                os.path.join(tempfile.gettempdir(), 'studyflow', f"{document_id}.json")
            ]
            
            for loc in locations:
                directory = os.path.dirname(loc)
                os.makedirs(directory, exist_ok=True)
                
                if os.path.exists(loc):
                    document_file = loc
                    print(f"Found document at: {document_file}")
                    try:
                        with open(document_file, 'r') as f:
                            document_data = json.load(f)
                        break
                    except Exception as e:
                        print(f"Error loading document from {loc}: {str(e)}")
            
            # If document not found, check if we should create a new one
            if not document_data:
                print("Document not found in any location - creating new document data")
                
                # For this example, create minimal document data when not found
                document_data = {
                    'file_id': document_id,
                    'pages': []
                }
                
                # Use the first location as the save location
                document_file = locations[0]

            # Process the uploaded file to extract text and page count
            # Assume we have a function that processes various file types
            
            # Create temp file info for processing
            new_file_info = {
                'id': unique_filename.split('.')[0],
                'original_name': original_filename,
                'path': file_path,
                'type': file_ext
            }
            
            # Process file to extract text
            if file_ext == 'pdf':
                new_pages_data = process_pdf(file_path)
            elif file_ext in ['jpg', 'jpeg', 'png']:
                new_pages_data = process_image(file_path)
            else:
                new_pages_data = [{
                    'page_number': len(document_data.get('pages', [])) + 1,
                    'text': f'Content from {original_filename}',
                    'summary': f'Uploaded file: {original_filename}',
                    'notes': ''
                }]
                
            # Calculate the starting page number for the new pages
            start_page_num = len(document_data.get('pages', [])) + 1
            
            # Now, if both files are PDFs, try to merge them
            try:
                import PyPDF2
                
                # Find the original PDF file path
                original_files = []
                for filename in os.listdir(upload_folder):
                    if filename.startswith(document_id) and filename.lower().endswith('.pdf'):
                        original_files.append(os.path.join(upload_folder, filename))
                
                # If we found the original file and both are PDFs
                if original_files and file_ext.lower() == 'pdf':
                    original_pdf_path = original_files[0]
                    merged_pdf_path = os.path.join(upload_folder, f"{document_id}.pdf")
                    
                    print(f"Attempting to merge PDFs: {original_pdf_path} and {file_path}")
                    
                    merger = PyPDF2.PdfMerger()
                    merger.append(original_pdf_path)
                    merger.append(file_path)
                    merger.write(merged_pdf_path)
                    merger.close()
                    
                    print(f"Successfully merged PDFs to: {merged_pdf_path}")
                    
                    # Optionally update the document data to point to the merged file
                    # This depends on how your viewer loads files
                    document_data['merged_pdf'] = True
                    document_data['original_file'] = original_pdf_path
                    document_data['merged_file'] = merged_pdf_path
            except Exception as e:
                print(f"Error merging PDFs: {str(e)}")
                # If merge fails, we still have the individual files
            
            # Renumber the new pages and add them to the document
            for i, page in enumerate(new_pages_data):
                page['page_number'] = start_page_num + i
                document_data['pages'].append(page)
            
            # Save updated document data
            print(f"Saving updated document to: {document_file}")
            directory = os.path.dirname(document_file)
            os.makedirs(directory, exist_ok=True)
            
            with open(document_file, 'w') as f:
                json.dump(document_data, f)

            print(f"Added {len(new_pages_data)} pages to document {document_id}")
            return jsonify({
                'message': f'New page(s) added successfully - {len(new_pages_data)} pages',
                'success': True,
                'document_id': document_id,
                'pages_added': len(new_pages_data)
            }), 200

        print("ERROR: Invalid file type")
        return jsonify({'error': 'Invalid file type', 'success': False}), 400

    except Exception as e:
        import traceback
        print(f"SERVER ERROR in add_page: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': f'Server error: {str(e)}',
            'success': False
        }), 500



@api.route('/remove-page', methods=['POST'])
def remove_page():
    """Handles removing a page from an existing document"""
    try:
        data = request.json
        document_id = data.get('documentId')
        page_id = int(data.get('pageId', 0))

        if not document_id or page_id <= 0:
            return jsonify({'error': 'Invalid document ID or page number'}), 400

        # Load document data
        temp_dir = os.path.join(os.path.join(current_app.config['UPLOAD_FOLDER'], 'studyflow'))
        document_file = os.path.join(temp_dir, f"{document_id}.json")

        if not os.path.exists(document_file):
            return jsonify({'error': 'Document not found'}), 404

        with open(document_file, 'r') as f:
            document_data = json.load(f)

        # Filter out the page to be removed
        document_data['pages'] = [p for p in document_data['pages'] if p['page_number'] != page_id]

        # Reorder remaining pages
        for index, page in enumerate(document_data['pages']):
            page['page_number'] = index + 1

        # Save the updated document
        with open(document_file, 'w') as f:
            json.dump(document_data, f)

        return jsonify({
            'message': 'Page removed successfully',
            'success': True,
            'document_id': document_id
        }), 200

    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500
    
    
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
    """Analyze a file and generate summaries for its pages"""
    try:
        print(f"Analyze request for file: {file_id}")
        # Get model param from request if provided
        data = request.get_json() or {}
        model = data.get('model', None)  # Use default if not specified
        
        temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
        file_path = os.path.join(temp_dir, f"{file_id}.json")
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
            
        with open(file_path, 'r') as f:
            file_data = json.load(f)
            
        # Generate summaries for each page
        for page in file_data.get('pages', []):
            page_text = page.get('text', '')
            if page_text:
                # Generate summary using specified or default model
                page['summary'] = generate_summary(page_text, model=model)
            else:
                page['summary'] = "No text content available to summarize."
                
        # Save updated data
        with open(file_path, 'w') as f:
            json.dump(file_data, f)
            
        return jsonify({'status': 'success', 'message': 'Analysis complete'}), 200
    except Exception as e:
        print(f"Error analyzing file: {str(e)}")
        return jsonify({'error': f'Error analyzing file: {str(e)}'}), 500

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
    
    # Look for the original file or the merged file
    upload_folder = current_app.config['UPLOAD_FOLDER']
    
    # Check for a merged PDF first
    merged_pdf_path = os.path.join(upload_folder, f"{file_id}_merged.pdf")
    if os.path.exists(merged_pdf_path):
        original_file_path = merged_pdf_path
        file_type = 'pdf'
    else:
        # Fall back to the original search 
        original_files = glob.glob(os.path.join(upload_folder, f"{file_id}.*"))
        original_file_path = original_files[0] if original_files else None
        file_type = os.path.splitext(original_file_path)[1].lower()[1:] if original_file_path else "unknown"
    
    if original_file_path:
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
                
                # Add flag to indicate if this is a merged PDF
                data['is_merged'] = os.path.exists(merged_pdf_path)
                
                return jsonify(data), 200
        except Exception as e:
            print(f"Error loading file data: {str(e)}")
    
    # If we couldn't load the data, return dummy data
    return jsonify({
        'file_type': file_type,
        'file_url': file_url,
        'download_url': download_url,
        'pdf_page_images': pdf_page_images,
        'is_merged': os.path.exists(merged_pdf_path),
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
    model = data.get('model')  # Optional model selection
    
    print(f"Ask question request data: {data}")
    
    if not question:
        return jsonify({'error': 'Question is required'}), 400
    
    if not file_id:
        return jsonify({'error': 'file_id is required'}), 400
    
    try:
        # Log the question for debugging
        print(f"Question asked: '{question}' for file {file_id}, page {page_id}, model {model or 'default'}")
        
        # Get answer using the current page for better context
        answer = get_answer(question, file_id, page_id, model=model)
        
        return jsonify({
            'answer': answer,
            'model_used': model
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

@api.route('/debug/document/<file_id>', methods=['GET'])
def debug_document(file_id):
    """Debug endpoint to check document data"""
    import json
    import os
    import tempfile
    
    response_data = {
        'file_id': file_id,
        'locations_checked': [],
        'document_found': False,
        'document_data': None
    }
    
    # Check uploads/studyflow location
    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'studyflow')
    file_path1 = os.path.join(upload_dir, f"{file_id}.json")
    response_data['locations_checked'].append({
        'path': file_path1,
        'exists': os.path.exists(file_path1)
    })
    
    # Check temp/studyflow location
    temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
    file_path2 = os.path.join(temp_dir, f"{file_id}.json")
    response_data['locations_checked'].append({
        'path': file_path2,
        'exists': os.path.exists(file_path2)
    })
    
    # Load file if found
    for location in response_data['locations_checked']:
        if location['exists']:
            try:
                with open(location['path'], 'r') as f:
                    response_data['document_data'] = json.load(f)
                    response_data['document_found'] = True
                    break
            except Exception as e:
                location['error'] = str(e)
    
    return jsonify(response_data)

@api.route('/debug/document/health-check', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'API is operational'
    }), 200

@api.route('/models', methods=['GET'])
def get_models():
    """Get information about available AI models"""
    try:
        model_info = get_available_models()
        return jsonify(model_info), 200
    except Exception as e:
        print(f"Error retrieving model information: {str(e)}")
        return jsonify({'error': 'Error retrieving model information'}), 500 