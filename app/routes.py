from flask import Blueprint, render_template, redirect, url_for, current_app, request, jsonify, send_from_directory
import os

main = Blueprint('main', __name__)

@main.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@main.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)

# Error handling routes
@main.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

@main.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500 