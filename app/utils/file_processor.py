import os
import PyPDF2
from PIL import Image
import pytesseract
import json
import tempfile

def process_file(file_path):
    """Extract text from a file
    
    Args:
        file_path (str): Path to the file
    
    Returns:
        dict: Dictionary containing the extracted data
    """
    try:
        # Get file extension
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Process based on file type
        if file_ext == '.pdf':
            print(f"Processing PDF file: {file_path}")
            pages_data = process_pdf(file_path)
            return {'pages': pages_data}
        elif file_ext in ['.jpg', '.jpeg', '.png']:
            print(f"Processing image file: {file_path}")
            pages_data = process_image(file_path)
            return {'pages': pages_data}
        else:
            print(f"Unsupported file type: {file_ext}")
            return {
                'pages': [{
                    'page_number': 1,
                    'text': f"[Unsupported file type: {file_ext}]",
                    'summary': "This file type is not supported.",
                    'notes': ''
                }]
            }
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {
            'pages': [{
                'page_number': 1,
                'text': f"[Error processing file: {str(e)}]",
                'summary': "An error occurred while processing this file.",
                'notes': ''
            }]
        }

def process_pdf(file_path):
    """Extract text from PDF file
    
    Args:
        file_path (str): Path to the PDF file
    
    Returns:
        list: List of dictionaries containing page data
    """
    pages_data = []
    
    try:
        print(f"Opening PDF file: {file_path}")
        
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"Error: PDF file not found at path: {file_path}")
            return [{
                'page_number': 1,
                'text': f"[Error: PDF file not found at path: {file_path}]",
                'summary': "",
                'notes': ''
            }]
            
        # Check file size
        file_size = os.path.getsize(file_path)
        print(f"PDF file size: {file_size} bytes")
        
        if file_size == 0:
            print("Error: PDF file is empty (0 bytes)")
            return [{
                'page_number': 1,
                'text': "[Error: PDF file is empty (0 bytes)]",
                'summary': "",
                'notes': ''
            }]
        
        with open(file_path, 'rb') as pdf_file:
            try:
                # Try to handle any PDF-related exceptions
                try:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                except Exception as e:
                    print(f"Error initializing PDF reader: {str(e)}")
                    return [{
                        'page_number': 1,
                        'text': f"[Error initializing PDF reader: {str(e)}]",
                        'summary': "",
                        'notes': ''
                    }]
                
                try:
                    num_pages = len(pdf_reader.pages)
                    print(f"PDF has {num_pages} pages")
                except Exception as e:
                    print(f"Error getting page count: {str(e)}")
                    return [{
                        'page_number': 1,
                        'text': f"[Error getting page count: {str(e)}]",
                        'summary': "",
                        'notes': ''
                    }]
                
                if num_pages == 0:
                    print("Warning: PDF has 0 pages")
                    return [{
                        'page_number': 1,
                        'text': "[PDF has 0 pages]",
                        'summary': "",
                        'notes': ''
                    }]
                
                # Process each page
                for i in range(num_pages):
                    try:
                        page = pdf_reader.pages[i]
                        text = page.extract_text() or f"[Page {i+1} - No text could be extracted]"
                        
                        page_data = {
                            'page_number': i + 1,
                            'text': text,
                            'summary': "",
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
                            'summary': "",
                            'notes': ''
                        })
            except Exception as e:
                print(f"Error reading PDF with PyPDF2: {str(e)}")
                # If PyPDF2 fails, return a single page with error info
                pages_data.append({
                    'page_number': 1,
                    'text': f"[Error reading PDF: {str(e)}]",
                    'summary': "",
                    'notes': ''
                })
    except Exception as e:
        print(f"Error opening PDF file: {str(e)}")
        # If we can't even open the file, return a single page with error info
        pages_data.append({
            'page_number': 1,
            'text': f"[Error opening file: {str(e)}]",
            'summary': "",
            'notes': ''
        })
    
    # Ensure we return at least one page
    if not pages_data:
        pages_data.append({
            'page_number': 1,
            'text': "[No content could be extracted from this PDF]",
            'summary': "",
            'notes': ''
        })
    
    return pages_data

def process_image(file_path):
    """Extract text from image using OCR
    
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
            else:
                print("Performing OCR on image...")
                text = pytesseract.image_to_string(image)
                
                if not text.strip():
                    text = "[No text could be extracted from this image]"
                    print("OCR completed but no text was found")
                else:
                    print(f"OCR completed, extracted {len(text)} characters")
            
            page_data = {
                'page_number': 1,
                'text': text,
                'summary': "",
                'notes': ''
            }
            
            return [page_data]
        except Exception as e:
            print(f"Error performing OCR: {str(e)}")
            return [{
                'page_number': 1,
                'text': f"[Error extracting text: {str(e)}]",
                'summary': "",
                'notes': ''
            }]
    except Exception as e:
        print(f"Error opening image file: {str(e)}")
        return [{
            'page_number': 1,
            'text': f"[Error opening image: {str(e)}]",
            'summary': "",
            'notes': ''
        }]

def save_processed_data(file_id, processed_data):
    """Save processed data to a temporary file
    
    Args:
        file_id (str): The ID of the file
        processed_data (dict): The processed data to save
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Create temp directory if it doesn't exist
        temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save processed data to file
        file_path = os.path.join(temp_dir, f"{file_id}.json")
        with open(file_path, 'w') as f:
            json.dump(processed_data, f)
            
        print(f"Saved processed data to {file_path}")
        return True
    except Exception as e:
        print(f"Error saving processed data: {str(e)}")
        return False 