import os
import PyPDF2
from PIL import Image
import pytesseract
from app.utils.document_analyzer import generate_summary
import json
import tempfile

def process_file(file_info):
    """Process an uploaded file (PDF or image)
    
    Args:
        file_info (dict): Dictionary containing file information
            - id: unique file ID
            - path: path to the file
            - type: file extension
            - original_name: original filename
    
    Returns:
        bool: True if processing was successful, False otherwise
    """
    try:
        file_path = file_info['path']
        file_type = file_info['type'].lower()
        
        pages_data = []
        
        if file_type == 'pdf':
            pages_data = process_pdf(file_path)
        elif file_type in ['png', 'jpg', 'jpeg']:
            # Check if tesseract is available
            try:
                import shutil
                tesseract_available = shutil.which('tesseract') is not None
                if not tesseract_available:
                    print("Warning: Tesseract OCR not found in PATH. OCR may not work properly.")
                    # Still try to process the image
            except Exception as e:
                print(f"Error checking for Tesseract: {str(e)}")
            
            pages_data = process_image(file_path)
        else:
            return False
        
        # Save processed data
        save_result = save_processed_data(file_info['id'], pages_data)
        
        return save_result
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return False

def process_pdf(file_path):
    """Extract text from PDF file and generate summaries
    
    Args:
        file_path (str): Path to the PDF file
    
    Returns:
        list: List of dictionaries containing page data
    """
    pages_data = []
    
    try:
        print(f"Opening PDF file: {file_path}")
        with open(file_path, 'rb') as pdf_file:
            try:
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                num_pages = len(pdf_reader.pages)
                print(f"PDF has {num_pages} pages")
                
                for i in range(num_pages):
                    try:
                        page = pdf_reader.pages[i]
                        text = page.extract_text() or f"[Page {i+1} - No text could be extracted]"
                        
                        # Generate summary
                        summary = generate_summary(text)
                        
                        page_data = {
                            'page_number': i + 1,
                            'text': text,
                            'summary': summary,
                            'notes': ''
                        }
                        
                        pages_data.append(page_data)
                        print(f"Processed page {i+1}/{num_pages}")
                    except Exception as e:
                        print(f"Error processing page {i+1}: {str(e)}")
                        # Add a placeholder for this page
                        pages_data.append({
                            'page_number': i + 1,
                            'text': f"[Error extracting text from page {i+1}: {str(e)}]",
                            'summary': "Could not generate summary due to text extraction error.",
                            'notes': ''
                        })
            except Exception as e:
                print(f"Error reading PDF with PyPDF2: {str(e)}")
                # If PyPDF2 fails, return a single page with error info
                pages_data.append({
                    'page_number': 1,
                    'text': f"[Error reading PDF: {str(e)}]",
                    'summary': "Could not process this PDF file.",
                    'notes': ''
                })
    except Exception as e:
        print(f"Error opening PDF file: {str(e)}")
        # If we can't even open the file, return a single page with error info
        pages_data.append({
            'page_number': 1,
            'text': f"[Error opening file: {str(e)}]",
            'summary': "Could not open this PDF file.",
            'notes': ''
        })
    
    # Ensure we return at least one page
    if not pages_data:
        pages_data.append({
            'page_number': 1,
            'text': "[No content could be extracted from this PDF]",
            'summary': "No content available to summarize.",
            'notes': ''
        })
    
    return pages_data

def process_image(file_path):
    """Extract text from image using OCR and generate summaries
    
    Args:
        file_path (str): Path to the image file
    
    Returns:
        list: List containing a single dictionary with page data
    """
    try:
        print(f"Opening image file: {file_path}")
        image = Image.open(file_path)
        
        try:
            # Check for Tesseract and set its path explicitly for macOS
            import shutil
            import platform
            import os
            
            # Set common Tesseract paths based on OS
            if platform.system() == 'Darwin':  # macOS
                possible_paths = [
                    '/opt/homebrew/bin/tesseract',  # Apple Silicon
                    '/usr/local/bin/tesseract',     # Intel Mac
                    '/opt/local/bin/tesseract',     # MacPorts
                ]
                
                # Set the first path that exists
                for path in possible_paths:
                    if os.path.exists(path):
                        print(f"Found Tesseract at: {path}")
                        pytesseract.pytesseract.tesseract_cmd = path
                        break
            
            # Check if tesseract is available
            tesseract_path = pytesseract.pytesseract.tesseract_cmd
            tesseract_available = os.path.exists(tesseract_path) if tesseract_path != 'tesseract' else shutil.which('tesseract') is not None
            
            print(f"Tesseract path: {tesseract_path}")
            print(f"Tesseract available: {tesseract_available}")
            
            if not tesseract_available:
                print("Tesseract OCR not found. Using fallback mode.")
                # Generate a placeholder response
                text = "[Image uploaded successfully but OCR is not available. Tesseract OCR needs to be installed.]"
                summary = "Image processing requires Tesseract OCR to be installed."
            else:
                print("Performing OCR on image...")
                text = pytesseract.image_to_string(image)
                
                if not text.strip():
                    text = "[No text could be extracted from this image]"
                    print("OCR completed but no text was found")
                else:
                    print(f"OCR completed, extracted {len(text)} characters")
                
                # Generate summary
                summary = generate_summary(text)
            
            page_data = {
                'page_number': 1,
                'text': text,
                'summary': summary if 'summary' in locals() else "No summary available for this image.",
                'notes': ''
            }
            
            return [page_data]
        except Exception as e:
            print(f"Error performing OCR: {str(e)}")
            return [{
                'page_number': 1,
                'text': f"[Error extracting text: {str(e)}]",
                'summary': "Could not generate summary due to OCR error.",
                'notes': ''
            }]
    except Exception as e:
        print(f"Error opening image file: {str(e)}")
        return [{
            'page_number': 1,
            'text': f"[Error opening image: {str(e)}]",
            'summary': "Could not open this image file.",
            'notes': ''
        }]

def save_processed_data(file_id, pages_data):
    """Save processed data to a temporary JSON file (in a real app, this would go to a database)
    
    Args:
        file_id (str): Unique file ID
        pages_data (list): List of dictionaries containing page data
    """
    try:
        # Create a temporary directory if it doesn't exist
        temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save data to a JSON file
        output_path = os.path.join(temp_dir, f"{file_id}.json")
        
        # Check if the directory is writable
        if not os.access(temp_dir, os.W_OK):
            print(f"Warning: Directory {temp_dir} is not writable")
            # Try to use the current directory instead
            output_path = f"{file_id}.json"
        
        with open(output_path, 'w') as f:
            json.dump({'pages': pages_data}, f)
            
        print(f"Successfully saved data to {output_path}")
        return True
    except Exception as e:
        print(f"Error saving processed data: {str(e)}")
        return False 