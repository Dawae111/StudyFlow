export const api = {
    async uploadFile(formData) {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        return response.json();
    },

    async analyzeDocument(fileId) {
        const response = await fetch(`/api/analyze/${fileId}`, {
            method: 'POST'
        });
        return response.json();
    },

    async fetchDocumentData(fileId) {
        const response = await fetch(`/api/summaries/${fileId}`);
        return response.json();
    },

    async askQuestion(question, fileId, pageId) {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, fileId, pageId })
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
    }
};