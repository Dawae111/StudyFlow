import { api } from './api.js';

export class StudyTools {
    constructor(elements) {
        this.elements = elements;
        this.currentFileId = null;
        this.currentPageId = 1;
        this.models = null;
        this.selectedSummaryModel = null;
        this.initializeEventListeners();
        this.loadAvailableModels();
    }

    async loadAvailableModels() {
        try {
            const modelData = await api.getAvailableModels();
            if (modelData.available) {
                this.models = modelData.models;
                this.selectedSummaryModel = modelData.default_summary_model;
                this.createModelSelector();
            }
        } catch (error) {
            console.error('Error loading AI models:', error);
        }
    }

    createModelSelector() {
        // Only create if we have models and the selector doesn't exist yet
        if (!this.models || document.getElementById('summary-model-selector')) {
            return;
        }

        // Create a model selector for the summary view
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'model-selector-container flex items-center mb-2 text-xs';
        selectorContainer.innerHTML = `
            <label for="summary-model-selector" class="mr-2 text-gray-700">Summary model:</label>
            <select id="summary-model-selector" class="p-1 border rounded text-xs">
                ${Object.keys(this.models).map(model => `
                    <option value="${model}" ${model === this.selectedSummaryModel ? 'selected' : ''}>
                        ${model}
                    </option>
                `).join('')}
            </select>
            <div class="ml-2 text-gray-500 model-info"></div>
            <button id="regenerate-summary" class="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">
                Regenerate
            </button>
        `;

        // Insert at the top of the summary section
        const summaryContainer = this.elements.summaryContent;
        summaryContainer.insertBefore(selectorContainer, summaryContainer.firstChild);

        // Add event listeners
        const selector = document.getElementById('summary-model-selector');
        const modelInfo = selectorContainer.querySelector('.model-info');
        const regenerateBtn = document.getElementById('regenerate-summary');

        // Update model info initially
        this.updateModelInfo(modelInfo, this.selectedSummaryModel);

        // Update when selection changes
        selector.addEventListener('change', () => {
            this.selectedSummaryModel = selector.value;
            this.updateModelInfo(modelInfo, this.selectedSummaryModel);
        });

        // Regenerate summary with selected model
        regenerateBtn.addEventListener('click', () => this.regenerateSummary());
    }

    updateModelInfo(infoElement, modelName) {
        if (this.models && this.models[modelName]) {
            const model = this.models[modelName];
            infoElement.textContent = `${model.description}`;
        }
    }

    async regenerateSummary() {
        if (!this.currentFileId || !this.currentPageId) {
            return;
        }

        try {
            // Show loading indicator
            const summaryContent = this.elements.summaryContent.querySelector('.summary-text');
            if (summaryContent) {
                summaryContent.innerHTML = '<p class="text-gray-500">Regenerating summary...</p>';
            }

            // Call API to regenerate the summary
            await api.analyzeDocument(this.currentFileId, this.selectedSummaryModel);

            // Reload the document data
            const docData = await api.fetchDocumentData(this.currentFileId);

            // Find the current page
            const currentPage = docData.pages.find(p => p.page_number === this.currentPageId);
            if (currentPage) {
                this.updateContent(currentPage);
            }
        } catch (error) {
            console.error('Error regenerating summary:', error);
            alert('Failed to regenerate summary. Please try again.');
        }
    }

    initializeEventListeners() {
        const { tabSummary, tabQA, tabNotes, askButton, questionInput, saveNotesButton } = this.elements;

        // Tab switching
        tabSummary.addEventListener('click', () => this.switchTab('summary'));
        tabQA.addEventListener('click', () => this.switchTab('qa'));
        tabNotes.addEventListener('click', () => this.switchTab('notes'));

        // Q&A functionality
        askButton.addEventListener('click', () => this.askQuestion());
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });

        // Notes functionality
        saveNotesButton.addEventListener('click', () => this.saveNotes());

        // Listen for page changes
        document.addEventListener('pageChanged', (e) => {
            // Update the currentPageId when page changes
            if (e.detail.page && e.detail.page.page_number) {
                this.currentPageId = e.detail.page.page_number;
                console.log(`StudyTools: Page changed to ${this.currentPageId}`);
            } else if (e.detail.pageId) {
                this.currentPageId = parseInt(e.detail.pageId);
                console.log(`StudyTools: Page changed to ${this.currentPageId} (from pageId)`);
            }

            // Update content with the new page data
            this.updateContent(e.detail.page);
        });

        // Listen for summary updates from background processing
        document.addEventListener('summariesUpdated', (e) => {
            this.handleSummariesUpdated(e.detail.documentData);
        });
    }

    setFileId(fileId) {
        this.currentFileId = fileId;
    }

    setCurrentPageId(pageId) {
        this.currentPageId = pageId;
    }

    updateContent(page) {
        if (!page) {
            console.warn('StudyTools: Received null page data in updateContent');
            return;
        }

        console.log(`StudyTools: Updating content for page ${page.page_number}`);

        // Store the current page data for Q&A
        this.currentPage = page;

        // Update the UI
        this.updateSummary(page.summary);
        this.updateNotes(page.notes);
    }

    switchTab(tab) {
        const contents = {
            summary: this.elements.summaryContent,
            qa: this.elements.qaContent,
            notes: this.elements.notesContent
        };

        const tabs = {
            summary: this.elements.tabSummary,
            qa: this.elements.tabQA,
            notes: this.elements.tabNotes
        };

        Object.values(contents).forEach(content => content.classList.add('hidden'));
        Object.values(tabs).forEach(tab => {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('bg-gray-200', 'text-gray-700');
        });

        contents[tab].classList.remove('hidden');
        tabs[tab].classList.remove('bg-gray-200', 'text-gray-700');
        tabs[tab].classList.add('bg-indigo-600', 'text-white');

        // Show/hide QA input container based on active tab
        const qaInputContainer = document.getElementById('qa-input-container');
        if (qaInputContainer) {
            if (tab === 'qa') {
                qaInputContainer.classList.remove('hidden');
            } else {
                qaInputContainer.classList.add('hidden');
            }
        }
    }

    // Function to convert simple markdown to HTML
    markdownToHtml(text) {
        if (!text) return '';

        // Handle bullet points (lines starting with '- ')
        text = text.replace(/^- (.+)$/gm, '<li>$1</li>');

        // If we added any list items, wrap them in a ul
        if (text.includes('<li>')) {
            text = text.replace(/<li>(.+)<\/li>/g, '<ul class="list-disc pl-5 space-y-1"><li>$1</li></ul>');
            // Clean up duplicate ul tags that might occur from regex
            text = text.replace(/<\/ul>\s*<ul class="list-disc pl-5 space-y-1">/g, '');
        }

        // Handle bold text (**text**)
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Handle line breaks
        text = text.replace(/\n/g, '<br>');

        return text;
    }

    updateSummaryDirectly(summary) {
        if (!summary || summary.trim() === '') {
            console.log('Empty summary received, not updating UI');
            return;
        }

        console.log('Directly updating summary in UI:', summary.substring(0, 50) + '...');

        // Simple, reliable way to update summary content
        const summaryContainer = document.getElementById('summary-content');
        if (summaryContainer) {
            // Convert markdown to HTML
            const formattedSummary = this.markdownToHtml(summary);

            summaryContainer.innerHTML = `
                <div class="summary-text p-4 bg-indigo-50 rounded-lg transition-colors border border-indigo-100">
                    <h4 class="font-semibold mb-2">Summary</h4>
                    <div class="summary-content whitespace-normal break-words">
                        <div class="text-base leading-relaxed markdown-content">${formattedSummary}</div>
                    </div>
                </div>
            `;

            // Use a more subtle highlight without changing colors/font
            const summaryText = summaryContainer.querySelector('.summary-text');
            if (summaryText) {
                summaryText.style.boxShadow = '0 0 0 2px rgba(79, 70, 229, 0.2)';
                setTimeout(() => {
                    summaryText.style.boxShadow = 'none';
                }, 2000);
            }
        } else {
            console.error('Could not find summary-content element');
        }
    }

    updateSummary(summary) {
        // Find if there's already a summary container
        let summaryTextContainer = this.elements.summaryContent.querySelector('.summary-text');

        // Check if summary is empty or not yet generated
        const needsGeneration = !summary || summary.trim() === '';

        // Convert markdown to HTML if summary exists
        const formattedSummary = needsGeneration ? '' : this.markdownToHtml(summary);

        if (summaryTextContainer) {
            if (needsGeneration) {
                summaryTextContainer.innerHTML = `
                <h4 class="font-semibold mb-2">Summary</h4>
                <p class="text-gray-500">Generating summary... This may take a moment.</p>
                <div class="mt-3 flex justify-center items-center">
                    <div class="animate-pulse mr-2 h-2 w-2 rounded-full bg-indigo-600"></div>
                    <div class="animate-pulse delay-75 mr-2 h-2 w-2 rounded-full bg-indigo-600"></div>
                    <div class="animate-pulse delay-150 h-2 w-2 rounded-full bg-indigo-600"></div>
                </div>
                `;
            } else {
                summaryTextContainer.innerHTML = `
                <h4 class="font-semibold mb-2">Summary</h4>
                <div class="summary-content whitespace-normal break-words">
                    <div class="text-base leading-relaxed markdown-content">${formattedSummary}</div>
                </div>
                `;
            }
        } else {
            if (needsGeneration) {
                this.elements.summaryContent.innerHTML = `
                <div class="summary-text p-4 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold mb-2">Summary</h4>
                <p class="text-gray-500">Generating summary... This may take a moment.</p>
                <div class="mt-3 flex justify-center items-center">
                    <div class="animate-pulse mr-2 h-2 w-2 rounded-full bg-indigo-600"></div>
                    <div class="animate-pulse delay-75 mr-2 h-2 w-2 rounded-full bg-indigo-600"></div>
                    <div class="animate-pulse delay-150 h-2 w-2 rounded-full bg-indigo-600"></div>
                </div>
                </div>
                `;
            } else {
                this.elements.summaryContent.innerHTML = `
                <div class="summary-text p-4 bg-indigo-50 rounded-lg">
                <h4 class="font-semibold mb-2">Summary</h4>
                <div class="summary-content whitespace-normal break-words">
                    <div class="text-base leading-relaxed markdown-content">${formattedSummary}</div>
                </div>
                </div>
                `;
            }
        }
    }

    updateNotes(notes) {
        this.elements.notesTextarea.value = notes || '';
    }

    async askQuestion() {
        const question = this.elements.questionInput.value.trim();
        if (!question) return;

        console.log(`StudyTools: Asking question for file ${this.currentFileId}, page ${this.currentPageId}`);

        // Check if we have valid current page info
        if (!this.currentFileId) {
            console.error('StudyTools: No currentFileId available for Q&A');
            alert('Error: No document is currently loaded.');
            return;
        }

        // Default to page 1 if no page ID is set
        const pageId = this.currentPageId || 1;

        const questionEl = this.createQuestionElement(question);
        this.elements.qaHistory.appendChild(questionEl);
        this.elements.questionInput.value = '';

        // Ensure the new question is visible by scrolling to it
        this.scrollToBottom();

        try {
            console.log(`StudyTools: Sending Q&A request - File: ${this.currentFileId}, Page: ${pageId}, Question: ${question}`);
            const data = await api.askQuestion(question, this.currentFileId, pageId);
            console.log('StudyTools: Received Q&A response:', data);
            this.updateAnswer(questionEl, data);

            // Scroll to show the answer after it's loaded
            this.scrollToBottom();
        } catch (error) {
            console.error('StudyTools: Error in Q&A:', error);
            this.showAnswerError(questionEl);
        }
    }

    createQuestionElement(question) {
        const questionEl = document.createElement('div');
        questionEl.className = 'question-item bg-white rounded-lg shadow-sm mb-4';
        questionEl.innerHTML = `
            <div class="question p-3 bg-indigo-50 rounded-t-lg border-b">
                <span class="font-semibold">Q:</span> ${question}
            </div>
            <div class="answer p-3 bg-white rounded-b-lg">
                <span class="font-semibold">A:</span> <span class="loading-dots">...</span>
            </div>
        `;
        return questionEl;
    }

    updateAnswer(questionEl, data) {
        const answerEl = questionEl.querySelector('.answer');
        answerEl.innerHTML = `<span class="font-semibold">A:</span> ${data.answer}`;

        if (data.references?.length) {
            const refsEl = document.createElement('div');
            refsEl.className = 'references mt-2 text-xs text-gray-500';
            refsEl.innerHTML = `
                <span class="font-semibold">References:</span> ${data.references.join(', ')}
            `;
            answerEl.appendChild(refsEl);
        }

        // Ensure the answer is visible
        this.scrollToBottom();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            const qaHistory = this.elements.qaHistory;
            qaHistory.scrollTop = qaHistory.scrollHeight;
        });
    }

    showAnswerError(questionEl) {
        const answerEl = questionEl.querySelector('.answer');
        answerEl.innerHTML = `
            <span class="font-semibold">A:</span> Sorry, an error occurred while processing your question.
        `;
    }

    async saveNotes() {
        const notes = this.elements.notesTextarea.value.trim();

        try {
            await api.saveNotes(this.currentPageId, notes);
            this.showSaveSuccess();
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while saving your notes.');
        }
    }

    showSaveSuccess() {
        const saveBtn = this.elements.saveNotesButton;
        const originalText = saveBtn.textContent;

        saveBtn.textContent = 'Saved!';
        saveBtn.classList.add('bg-green-600');

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.classList.remove('bg-green-600');
        }, 2000);
    }

    // New method to handle updated summaries
    handleSummariesUpdated(documentData) {
        if (!documentData || !documentData.pages) {
            console.warn('Received invalid document data for summary update');
            return;
        }

        console.log('Received updated summaries for document');

        // Update current page content if we have an active page
        if (this.currentPageId) {
            const currentPage = documentData.pages.find(p => p.page_number === this.currentPageId);
            if (currentPage) {
                console.log(`Updating content for current page ${this.currentPageId}`);
                this.updateContent(currentPage);
            }
        }
    }
}