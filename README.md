# StudyFlow

StudyFlow is a web application that helps users engage more effectively with lecture slides, research papers, and other textual/visual materials by providing concise summaries, explanations, and an interactive Q&A interface.

## Features

- **File Upload**: Upload PDFs or images (JPEG, PNG) of study materials.
- **Automated Summaries**: Get concise, page-by-page summaries of your content.
- **Interactive Q&A**: Ask questions about specific pages or the entire document.
- **Note Taking**: Edit and save notes for each page.
- **Clean UI**: Modern, intuitive interface for a seamless learning experience.

## Installation

### Prerequisites

- Python 3.7+
- Tesseract OCR (for image processing)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/studyflow.git
   cd studyflow
   ```

2. Set up a virtual environment (recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set environment variables:
   - Create a `.env` file in the project root with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key
   SECRET_KEY=your_flask_secret_key
   ```

5. Run the application:
   ```
   python app.py
   ```

6. Access the application at `http://localhost:5000`

## Usage

1. **Upload Files**: Drag and drop or browse to upload your PDF or image files.
2. **Navigate Pages**: Use the thumbnail navigation on the left to switch between pages.
3. **Read Summaries**: View AI-generated summaries for each page.
4. **Ask Questions**: Switch to the Q&A tab to ask questions about the content.
5. **Take Notes**: Add your own notes to supplement the AI summaries.

## System Architecture

- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS (Tailwind), JavaScript
- **NLP/AI**: LangChain with OpenAI integration
- **OCR**: Tesseract (for image processing) and PyPDF2 (for PDF processing)
- **Storage**: Local file system (in this MVP version)

## Development Notes

This is a hackathon MVP and has the following limitations:

- Uses local file storage instead of a database
- Summarization is mocked for hackathon purposes
- No user authentication system
- Limited error handling

In a production version, we would implement:
- Proper database integration (MongoDB/PostgreSQL)
- User authentication
- Actual LLM integration with OpenAI/other providers
- More robust error handling
- Asynchronous processing for larger documents

## License

[MIT License](LICENSE) 