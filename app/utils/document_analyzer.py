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

# Define available models with their capabilities and costs
AI_MODELS = {
    "gpt-3.5-turbo": {
        "description": "Fast and cost-effective model for most tasks",
        "max_tokens": 4000,
        "max_completion_tokens": 4000,
        "cost_per_1k": "$0.002",
        "use_case": "General purpose, summaries, Q&A"
    },
    "gpt-4-turbo": {
        "description": "Latest model with enhanced capabilities",
        "max_tokens": 128000,
        "max_completion_tokens": 4096,  # Maximum allowed for responses
        "cost_per_1k": "$0.01",
        "use_case": "Most advanced reasoning, analysis of larger documents"
    },
    "gpt-4": {
        "description": "More advanced reasoning and higher accuracy",
        "max_tokens": 8000,
        "max_completion_tokens": 4000,
        "cost_per_1k": "$0.03",
        "use_case": "Complex reasoning, detailed analysis"
    }
}

# Validate environment variables and default to known models if invalid
def validate_model_name(model_name):
    """Validate that the model name is one we support"""
    if not model_name or model_name not in AI_MODELS:
        print(f"Warning: Invalid model name '{model_name}', defaulting to gpt-3.5-turbo")
        return "gpt-3.5-turbo"
    return model_name

# Get environment variables with validation
env_summary_model = os.getenv("OPENAI_SUMMARY_MODEL", "gpt-3.5-turbo")
env_qa_model = os.getenv("OPENAI_QA_MODEL", "gpt-4")

# Default model selection (with validation)
DEFAULT_SUMMARY_MODEL = validate_model_name(env_summary_model)
DEFAULT_QA_MODEL = validate_model_name(env_qa_model)

print(f"Model validation complete - Using summary model: {DEFAULT_SUMMARY_MODEL}, Q&A model: {DEFAULT_QA_MODEL}")

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
            
            # Log available models from our configuration
            print(f"Available AI models configured: {', '.join(AI_MODELS.keys())}")
            print(f"Using {DEFAULT_SUMMARY_MODEL} for summaries and {DEFAULT_QA_MODEL} for Q&A")
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

def generate_summary(text, model=None):
    """Generate a summary for a given text using OpenAI
    
    Args:
        text (str): The text to summarize
        model (str, optional): The model to use. Defaults to DEFAULT_SUMMARY_MODEL.
    
    Returns:
        str: Summary of the text
    """
    # Use default model if none specified
    if model is None:
        model = DEFAULT_SUMMARY_MODEL
    
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
            # Get the max tokens for the model
            max_context_tokens = AI_MODELS.get(model, {}).get("max_tokens", 4000)
            max_completion_tokens = AI_MODELS.get(model, {}).get("max_completion_tokens", 4000)
            
            # Limit text length to avoid token limits (allow for 25% of max tokens for response)
            max_input_tokens = int(max_context_tokens * 0.75)
            if len(text) > max_input_tokens * 4:  # Rough character to token ratio
                text = text[:max_input_tokens * 4]
                print(f"Text truncated to ~{max_input_tokens} tokens for {model}")
            
            # Enhanced system message with more detailed instructions
            system_message = """
You are a tutor helping a student understand course materials. 
Use an approachable, clear, and educational tone.
Format your summaries with bullet points and highlight key concepts in bold.
Present information in a structured, logical flow.
Identify and emphasize the most important concepts.
Be precise while remaining accessible to students.
            """.strip()
            
            # Enhanced user prompt with more specific formatting instructions
            user_prompt = f"""
Summarize the following text for a student:

{text}

Format your summary as follows:
1. Begin with a brief 1-2 sentence overview of the main topic.
2. List the key points using bullet points (each starting with '- ').
3. For each important term or concept, highlight it using **bold**.
4. Keep each bullet point focused on a single concept.
5. If there are steps or processes mentioned, present them in a sequential order.
6. End with a 1-sentence conclusion or takeaway.
            """.strip()
            
            # Generate summary using Chat completions API with enhanced prompting
            response = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=min(int(max_context_tokens * 0.25), max_completion_tokens),  # Use the lower value
                temperature=0.2
            )
            
            summary = response.choices[0].message.content.strip()
            print(f"Successfully generated summary with {model}")
            return summary
            
        except Exception as e:
            print(f"Error with OpenAI summarization using {model}: {str(e)}")
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

def get_answer(question, file_id, page_id=None, model=None):
    """Get an answer to a question about a document
    
    Args:
        question (str): The question to answer
        file_id (str): The ID of the file to query
        page_id (str, optional): The specific page to query. Defaults to None.
        model (str, optional): The model to use. Defaults to DEFAULT_QA_MODEL.
    
    Returns:
        str: Answer to the question
    """
    # Use default model if none specified
    if model is None:
        model = DEFAULT_QA_MODEL
        
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
            
        # Try to use OpenAI
        if openai_available and openai_configured:
            try:
                # Get the max tokens for the model
                max_context_tokens = AI_MODELS.get(model, {}).get("max_tokens", 4000)
                max_completion_tokens = AI_MODELS.get(model, {}).get("max_completion_tokens", 4000)
                
                # Log which model is being used
                print(f"Using model: {model} with max_tokens: {max_context_tokens}")
                
                # For GPT-4-Turbo, use special handling for its larger context window
                if model == "gpt-4-turbo":
                    # For GPT-4-Turbo, use a larger portion of the context window
                    # Still limit to ~100K tokens to be safe (128K is the limit)
                    max_input_chars = 400000  # Approximate 100K tokens
                    original_length = len(context)
                    if len(context) > max_input_chars:
                        context = context[:max_input_chars]
                        print(f"Context truncated for GPT-4-Turbo from {original_length} chars to ~100K tokens")
                else:
                    # Original logic for other models
                    original_length = len(context)
                    max_input_tokens = int(max_context_tokens * 0.75)
                    max_chars = max_input_tokens * 4  # Approximate 4 chars per token
                    if len(context) > max_chars:
                        context = context[:max_chars]
                        print(f"Context truncated from {original_length} chars to ~{max_input_tokens} tokens for {model}")
                    else:
                        print(f"Context length OK: {len(context)} chars (~{len(context)/4} tokens) for {model}")
                
                # Define a reasonable output token limit based on the model
                if model == "gpt-4-turbo":
                    max_output_tokens = min(4000, max_completion_tokens)  # Generous output size for turbo
                else:
                    max_output_tokens = min(int(max_context_tokens * 0.25), max_completion_tokens)  # Use the lower value
                
                print(f"Making API call to {model} with context length: {len(context)} chars and max output tokens: {max_output_tokens}")
                
                # Enhanced system prompt for Q&A with stronger instructions against formatting
                system_message = """
You are an expert tutor for a college-level course with deep knowledge in this subject area.
IMPORTANT: You must provide ALL answers in plain text ONLY - do not use ANY special formatting:
- NO markdown formatting (no **, no *, no ## headings, no > blockquotes)
- NO LaTeX or math notation (no \( \), no \[ \], no $ symbols for math)
- NO formatting symbols of any kind
- DO NOT use asterisks for emphasis
- DO NOT use backslashes for equations

When answering questions:
1. Be thorough but clear in your explanations
2. Provide step-by-step reasoning when analytical thinking is needed
3. Use simple numbered or lettered lists for sequential steps
4. When appropriate, explain why the answer matters within the broader context
                """.strip()
                
                # Enhanced user prompt for Q&A with stronger warning against formatting
                user_prompt = f"""
The following text is from course materials:

{context}

Question: {question}

Please provide a clear and comprehensive answer that directly addresses the question. Structure your response in a way that helps understanding:

1. If relevant, briefly explain any key concepts involved
2. Present your reasoning step-by-step if the question requires analysis
3. End with a concise summary of the main answer

IMPORTANT FORMATTING RULE: You must use plain text ONLY:
- Do NOT use bold, italics, or any other text formatting
- Do NOT use special characters, asterisks, or underscores for emphasis
- Write mathematical expressions in plain text (example: write "w1 = 2/3" instead of using LaTeX formatting)
- Do NOT use LaTeX notation or any form of markup

Focus primarily on information from the provided text, but you may supplement with general knowledge when appropriate to provide a complete answer.
                """.strip()
                
                # Get answer using Chat completions API with enhanced prompting
                response = openai.ChatCompletion.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=max_output_tokens,
                    temperature=0.3
                )
                
                answer = response.choices[0].message.content.strip()
                print(f"Got answer from {model} with length: {len(answer)} chars")
                return answer
                
            except Exception as e:
                print(f"Error with OpenAI Q&A using {model}: {str(e)}")
                return generate_mock_answer(question, file_id, context)
        else:
            print("OpenAI not available or not configured, using mock answer")
            return generate_mock_answer(question, file_id, context)
            
    except Exception as e:
        print(f"Error getting answer: {str(e)}")
        return "Error processing your question. Please try again."

def get_available_models():
    """Return information about available models for the UI"""
    return {
        "available": openai_available and openai_configured,
        "models": AI_MODELS,
        "default_summary_model": DEFAULT_SUMMARY_MODEL,
        "default_qa_model": DEFAULT_QA_MODEL
    }

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