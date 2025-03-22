from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
import os


load_dotenv()

def create_app():
    app = Flask(__name__, 
                static_folder='static',
                template_folder='templates')
    
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-key-for-hackathon')
    app.config['UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'uploads')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
    
    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Enable CORS
    CORS(app)
    
    # Register blueprints
    from app.api.routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    # Register main routes
    from app.routes import main
    app.register_blueprint(main)
    
    return app 