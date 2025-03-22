export const api = {
    async uploadFile(formData) {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    async analyzeDocument(fileId, model = null) {
        const data = model ? { model } : {};

        const response = await fetch(`/api/analyze/${fileId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async fetchDocumentData(fileId) {
        // Sanitize the fileId to ensure it's URL-safe
        if (fileId && (fileId.includes('\\') || fileId.includes('/'))) {
            console.warn('API fetchDocumentData: File ID contains path separators:', fileId);
            fileId = fileId.split(/[\\\/]/).pop();
            console.log('API fetchDocumentData: Using sanitized ID:', fileId);
        }

        const response = await fetch(`/api/summaries/${encodeURIComponent(fileId)}`);
        return response.json();
    },

    async askQuestion(question, fileId, pageId, model = null) {
        const payload = {
            question,
            fileId,
            pageId
        };

        if (model) {
            payload.model = model;
        }

        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.json();
    },

    async saveNotes(pageId, notes) {
        const response = await fetch(`/api/notes/${pageId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userNotes: notes })
        });
        return response.json();
    },

    async getAvailableModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) {
                throw new Error('Failed to fetch model information');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching models:', error);
            return {
                available: false,
                models: {},
                default_summary_model: 'gpt-3.5-turbo',
                default_qa_model: 'gpt-3.5-turbo'
            };
        }
    },

    async addPage(formData) {
        try {
            // Check if documentId contains invalid characters
            const docId = formData.get('documentId');
            if (docId && (docId.includes('\\') || docId.includes('/'))) {
                console.warn('API addPage: Document ID contains path separators:', docId);
                // Sanitize the ID
                const sanitizedId = docId.split(/[\\\/]/).pop();
                console.log('API addPage: Using sanitized ID:', sanitizedId);

                // Create a new FormData instance with the sanitized ID
                const sanitizedFormData = new FormData();
                for (const [key, value] of formData.entries()) {
                    if (key === 'documentId') {
                        sanitizedFormData.append(key, sanitizedId);
                    } else {
                        sanitizedFormData.append(key, value);
                    }
                }
                formData = sanitizedFormData;
            }

            console.log('API addPage: Making request to /api/add-page');
            const response = await fetch('/api/add-page', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API addPage: Server returned ${response.status}`, errorText);
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API addPage: Fetch error', error);
            return {
                success: false,
                error: error.message || 'Network error occurred'
            };
        }
    },

    async removePage(documentId, pageId) {
        try {
            console.log(`API removePage: Making request for document ${documentId}, page ${pageId}`);
            const response = await fetch('/api/remove-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId, pageId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API removePage: Server returned ${response.status}`, errorText);
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API removePage: Fetch error', error);
            return {
                success: false,
                error: error.message || 'Network error occurred'
            };
        }
    },

    async listFiles() {
        const response = await fetch('/api/files');
        return response.json();
    }
};