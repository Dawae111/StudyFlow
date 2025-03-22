import os
import json
import tempfile

# Comment out LangChain imports
# from langchain.chains.summarize import load_summarize_chain
# from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain import OpenAI
# from langchain.docstore.document import Document
# from langchain.prompts import PromptTemplate

# Setup LLM
def get_llm():
    """Get the LLM model to use (OpenAI's GPT model)"""
    api_key = os.getenv("OPENAI_API_KEY", "your-api-key-here")
    # Return dummy LLM for now
    return "Dummy LLM"

def generate_summary(text):
    """Generate a summary for a given text
    
    Args:
        text (str): The text to summarize
    
    Returns:
        str: Summary of the text
    """
    try:
        # Check for error messages in the text
        if text.startswith("[Error"):
            return "Could not generate summary due to text extraction error."
        
        # Mock summary based on text length
        if len(text) < 100:
            return "Text too short to summarize meaningfully."
        
        # Mock summary based on text length
        words = text.split()
        if len(words) > 50:
            return "This page discusses " + " ".join(words[0:5]) + "... The content covers topics related to " + " ".join(words[20:25]) + " and includes information about " + " ".join(words[-5:]) + "."
        else:
            return "Brief content about " + " ".join(words[0:3]) + ". " + " ".join(words[-3:]) + " are also mentioned."
        
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        return "Error generating summary."

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
        
        # Get some real content to make answers more relevant
        pages = doc_data.get('pages', [])
        if not pages:
            return "No content found in this document."
            
        # Get the content of the specified page or the first few words from each page
        content_snippets = []
        if page_id:
            # Find the specific page
            for page in pages:
                if page.get('page_number') == int(page_id):
                    content_snippets = [page.get('text', '')[:100]]
                    break
        else:
            # Get snippets from all pages
            for page in pages:
                text = page.get('text', '')
                if text and not text.startswith("[Error"):
                    content_snippets.append(text[:50] + "...")
        
        # Use the content to craft a more relevant answer
        content_text = " ".join(content_snippets)
        words = content_text.split()
        relevant_words = [w for w in words if len(w) > 3][:10]  # Get some relevant words
        
        # Mock response based on the question and content
        if "what" in question.lower():
            return f"The document discusses various concepts related to {' and '.join(relevant_words[:3])}. This appears to be about {file_id.replace('-', ' ')}."
        elif "how" in question.lower():
            return f"The process involving {' and '.join(relevant_words[:2])} is explained in the document. It involves several steps related to {' and '.join(relevant_words[2:4])}."
        elif "why" in question.lower():
            return f"The reasons related to {' and '.join(relevant_words[:2])} are outlined in the document, primarily focusing on {relevant_words[2] if len(relevant_words) > 2 else 'key concepts'} and {relevant_words[3] if len(relevant_words) > 3 else 'related aspects'}."
        else:
            return f"Based on the document content about {' and '.join(relevant_words[:3])}, the answer relates to the information presented on page {pages[0].get('page_number', 1)} and other sections."
            
    except Exception as e:
        print(f"Error getting answer: {str(e)}")
        return "Error processing your question. Please try again."

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