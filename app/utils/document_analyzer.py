import os
import json
import tempfile
import importlib.util

# Check if OpenAI is installed
openai_available = importlib.util.find_spec("openai") is not None

# Only import if available
if openai_available:
    try:
        import openai
        print("Successfully imported OpenAI")
    except ImportError as e:
        print(f"Error importing OpenAI: {e}")
        openai_available = False

def configure_openai():
    """Configure the OpenAI client with API key and base URL"""
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        api_base = os.getenv("OPENAI_API_BASE")
        
        if not api_key:
            print("No OpenAI API key found in environment")
            return False
            
        openai.api_key = api_key
        
        # Set the API base URL if provided
        if api_base:
            print(f"Using custom API base: {api_base}")
            openai.api_base = api_base
        
        # Test the configuration with a simple request
        try:
            # Just get the list of models to verify connectivity
            openai.Model.list()
            print("OpenAI connection successful")
            return True
        except Exception as e:
            print(f"Error connecting to OpenAI: {str(e)}")
            return False
    except Exception as e:
        print(f"Error configuring OpenAI: {str(e)}")
        return False

# Try to configure OpenAI at module initialization
openai_configured = False
if openai_available:
    openai_configured = configure_openai()
    if not openai_configured:
        print("OpenAI configuration failed, will use mock responses")

def generate_summary(text):
    """Generate a summary for a given text using OpenAI
    
    Args:
        text (str): The text to summarize
    
    Returns:
        str: Summary of the text
    """
    try:
        # Check for error messages in the text
        if text.startswith("[Error"):
            return "Could not generate summary due to text extraction error."
        
        # If text is too short, return simple message
        if len(text) < 100:
            return "Text too short to summarize meaningfully."
        
        # Check if OpenAI is available and configured
        if not openai_available or not openai_configured:
            print("OpenAI not available or not configured, using mock summary")
            return generate_mock_summary(text)
        
        # Try to use OpenAI directly
        try:
            # Limit text length to avoid token limits
            max_tokens = 4000  # Leave room for response tokens
            if len(text) > max_tokens * 4:  # Rough character to token ratio
                text = text[:max_tokens * 4]
                print(f"Text truncated to ~{max_tokens} tokens")
            
            # Generate summary using Chat completions API
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise summaries."},
                    {"role": "user", "content": f"Write a concise summary of the following text in 2-3 sentences:\n\n{text}"}
                ],
                max_tokens=150,
                temperature=0.3
            )
            
            summary = response.choices[0].message.content.strip()
            print("Successfully generated summary with OpenAI")
            return summary
            
        except Exception as e:
            print(f"Error with OpenAI summarization: {str(e)}")
            # Fall back to mock if OpenAI fails
            return generate_mock_summary(text)
            
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        return "Error generating summary."

def generate_mock_summary(text):
    """Generate a mock summary when OpenAI is not available"""
    print("Generating mock summary")
    words = text.split()
    if len(words) > 50:
        return "This page discusses " + " ".join(words[0:5]) + "... The content covers topics related to " + " ".join(words[20:25]) + " and includes information about " + " ".join(words[-5:]) + "."
    else:
        return "Brief content about " + " ".join(words[0:3]) + ". " + " ".join(words[-3:]) + " are also mentioned."

def get_answer(question, file_id, page_id=None):
    """Get an answer to a question about a document
    
    Args:
        question (str): The question to answer
        file_id (str): The ID of the file to query
        page_id (str, optional): The specific page to query. Defaults to None.
    
    Returns:
        str: Answer to the question
    """
    try:
        # Get document data
        doc_data = load_document_data(file_id)
        
        if not doc_data:
            return "Document not found or not processed yet. Please try uploading again."
        
        # Get relevant content
        pages = doc_data.get('pages', [])
        if not pages:
            return "No content found in this document."
            
        # Get the content based on page_id
        if page_id:
            # Use the specific page
            page_content = ""
            for page in pages:
                if str(page.get('page_number')) == str(page_id):
                    page_content = page.get('text', '')
                    break
            if not page_content:
                return f"Page {page_id} not found in this document."
            context = page_content
        else:
            # Use all pages
            context = "\n\n".join([page.get('text', '') for page in pages if page.get('text')])
        
        # Check if there's any valid content
        if not context or context.isspace():
            return "No valid text content found to answer your question."
            
        # Limit context length to avoid token limits
        max_tokens = 4000
        if len(context) > max_tokens * 4:
            context = context[:max_tokens * 4]
            print(f"Context truncated to ~{max_tokens} tokens")
        
        # Try to use OpenAI
        if openai_available and openai_configured:
            try:
                # Get answer using Chat completions API
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that answers questions based on the provided document text."},
                        {"role": "user", "content": f"Based on this content:\n\n{context}\n\nAnswer this question: {question}"}
                    ],
                    max_tokens=200,
                    temperature=0.5
                )
                
                return response.choices[0].message.content.strip()
                
            except Exception as e:
                print(f"Error with OpenAI Q&A: {str(e)}")
                return generate_mock_answer(question, file_id, context)
        else:
            print("OpenAI not available or not configured, using mock answer")
            return generate_mock_answer(question, file_id, context)
            
    except Exception as e:
        print(f"Error getting answer: {str(e)}")
        return "Error processing your question. Please try again."

def generate_mock_answer(question, file_id, context):
    """Generate a mock answer when OpenAI is not available"""
    print("Generating mock answer")
    # Use the content to craft a more relevant answer
    words = context.split()[:100]  # Just use first 100 words
    relevant_words = [w for w in words if len(w) > 3][:10]  # Get some relevant words
    
    # Mock response based on the question and content
    if "what" in question.lower():
        return f"The document discusses various concepts related to {' and '.join(relevant_words[:3])}. This appears to be about {file_id.replace('-', ' ')}."
    elif "how" in question.lower():
        return f"The process involving {' and '.join(relevant_words[:2])} is explained in the document. It involves several steps related to {' and '.join(relevant_words[2:4])}."
    elif "why" in question.lower():
        return f"The reasons related to {' and '.join(relevant_words[:2])} are outlined in the document, primarily focusing on {relevant_words[2] if len(relevant_words) > 2 else 'key concepts'} and {relevant_words[3] if len(relevant_words) > 3 else 'related aspects'}."
    else:
        return f"Based on the document content about {' and '.join(relevant_words[:3])}, the answer relates to the information presented in the text."

def load_document_data(file_id):
    """Load document data from the temporary storage
    
    Args:
        file_id (str): The ID of the file
    
    Returns:
        dict: Document data
    """
    temp_dir = os.path.join(tempfile.gettempdir(), 'studyflow')
    file_path = os.path.join(temp_dir, f"{file_id}.json")
    
    if not os.path.exists(file_path):
        return None
    
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading document data: {str(e)}")
        return None 