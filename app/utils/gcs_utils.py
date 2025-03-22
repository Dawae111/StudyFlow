from google.cloud import storage
from flask import current_app
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename

def get_gcs_client():
    """Create and return a Google Cloud Storage client"""
    return storage.Client()

def upload_file_to_gcs(file_obj, file_id, file_extension, original_filename=None):
    """Upload a file to Google Cloud Storage
    
    Args:
        file_obj: File object to upload
        file_id (str): Unique identifier for the file
        file_extension (str): File extension (e.g., 'pdf', 'jpg')
        original_filename (str, optional): Original filename to use as prefix
    
    Returns:
        str: GCS URL of the uploaded file
    """
    try:
        client = get_gcs_client()
        bucket_name = current_app.config['GOOGLE_CLOUD_BUCKET']
        bucket = client.bucket(bucket_name)
        
        # Use provided original filename or get from file object
        if original_filename:
            original_name_without_ext = os.path.splitext(secure_filename(original_filename))[0]
        else:
            original_name_without_ext = os.path.splitext(secure_filename(file_obj.filename))[0]
        
        # Create the GCS blob (path in bucket) with original filename as prefix
        blob_name = f"uploads/{original_name_without_ext}_{file_id}.{file_extension}"
        blob = bucket.blob(blob_name)
        
        # Determine content type based on file extension
        content_type = None
        if file_extension == 'pdf':
            content_type = 'application/pdf'
        elif file_extension in ['jpg', 'jpeg']:
            content_type = 'image/jpeg'
        elif file_extension == 'png':
            content_type = 'image/png'
        
        # Upload the file
        blob.upload_from_file(
            file_obj,
            content_type=content_type
        )
        
        # Generate a signed URL that expires in 7 days
        url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.utcnow() + timedelta(days=7),
            method="GET"
        )
        
        return url
        
    except Exception as e:
        print(f"Error uploading to GCS: {str(e)}")
        raise

def get_file_from_gcs(file_id, file_extension, original_filename=None):
    """Get a file from Google Cloud Storage
    
    Args:
        file_id (str): Unique identifier for the file
        file_extension (str): File extension (e.g., 'pdf', 'jpg')
        original_filename (str, optional): Original filename to use as prefix
    
    Returns:
        bytes: File contents
    """
    try:
        client = get_gcs_client()
        bucket_name = current_app.config['GOOGLE_CLOUD_BUCKET']
        bucket = client.bucket(bucket_name)
        
        # Create blob name with original filename prefix if provided
        if original_filename:
            original_name_without_ext = os.path.splitext(secure_filename(original_filename))[0]
            blob_name = f"uploads/{original_name_without_ext}_{file_id}.{file_extension}"
        else:
            blob_name = f"uploads/{file_id}.{file_extension}"
            
        print(f"Attempting to get file from GCS: {blob_name}")
        blob = bucket.blob(blob_name)
        
        # Download the file content
        return blob.download_as_bytes()
        
    except Exception as e:
        print(f"Error getting file from GCS: {str(e)}")
        raise

def delete_file_from_gcs(file_id, file_extension):
    """Delete a file from Google Cloud Storage
    
    Args:
        file_id (str): Unique identifier for the file
        file_extension (str): File extension (e.g., 'pdf', 'jpg')
    """
    try:
        client = get_gcs_client()
        bucket_name = current_app.config['GOOGLE_CLOUD_BUCKET']
        bucket = client.bucket(bucket_name)
        
        blob_name = f"uploads/{file_id}.{file_extension}"
        blob = bucket.blob(blob_name)
        
        # Delete the blob
        blob.delete()
        
    except Exception as e:
        print(f"Error deleting file from GCS: {str(e)}")
        raise 