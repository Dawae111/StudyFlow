import { api } from './api.js';

export class QAHandler {
    constructor(elements, appController) {
        this.elements = elements;
        this.appController = appController;
        this.models = null;
        this.selectedModel = null;
        this.questionsByPage = {}; // Store questions by page ID
        this.currentPageId = 1;
        this.initializeEventListeners();
        this.loadAvailableModels();
        this.loadQuestionsFromStorage();

        // Debug log storage status
        this.logStorageStatus();
    }

    initializeEventListeners() {
        this.elements.askButton.addEventListener('click', () => this.askQuestion());
        this.elements.questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });

        // Listen for page change events
        document.addEventListener('pageChanged', (e) => {
            if (e.detail && e.detail.page) {
                this.onPageChanged(e.detail.page);
            }
        });
    }

    loadQuestionsFromStorage() {
        try {
            // Only load questions if we have a current file ID
            const fileId = this.appController.currentFileId;
            if (!fileId) {
                console.warn('No file ID available, skipping question loading');
                return;
            }

            const storageKey = `studyflow_questions_${fileId}`;
            console.log(`Loading questions from storage for file: ${fileId}`);
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    console.log(`Found ${Object.keys(parsedData).length} pages with questions:`, parsedData);

                    // Process saved questions to recreate DOM elements
                    Object.keys(parsedData).forEach(pageId => {
                        const pageQuestions = parsedData[pageId];
                        if (!pageQuestions || !Array.isArray(pageQuestions)) {
                            console.warn(`Invalid questions data for page ${pageId}:`, pageQuestions);
                            return;
                        }

                        // Ensure pageId is stored as a string in our object
                        const normalizedPageId = String(pageId);
                        console.log(`Processing ${pageQuestions.length} questions for page ${normalizedPageId}`);

                        this.questionsByPage[normalizedPageId] = pageQuestions.map(item => {
                            // Make sure we have a valid question object
                            if (!item || !item.question) {
                                console.warn("Invalid question item:", item);
                                return null;
                            }

                            // Recreate the element
                            const questionElement = document.createElement('div');
                            questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg mb-3';

                            // Format HTML based on whether we have an answer or error
                            if (item.error) {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">You: ${item.question}</p>
                                    <div class="answer mt-2">
                                        <p class="text-red-500">Error: Failed to get an answer. Please try again.</p>
                                    </div>
                                `;
                            } else if (item.answer) {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">You: ${item.question}</p>
                                    <div class="answer mt-2">
                                        <p>${item.answer}</p>
                                        <p class="text-xs text-gray-500 mt-1">Answered using ${item.modelUsed || 'AI'}</p>
                                    </div>
                                `;
                            } else {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">You: ${item.question}</p>
                                    <div class="answer mt-2">
                                        <p class="text-gray-500">Loading answer...</p>
                                    </div>
                                `;
                            }

                            // Return updated item with the element
                            return {
                                ...item,
                                element: questionElement
                            };
                        }).filter(item => item !== null); // Remove any invalid items
                    });
                } catch (e) {
                    console.error("Error parsing saved questions data:", e);
                }

                // Display questions for current page
                this.displayQuestionsForCurrentPage();

                console.log("After loading from storage, questionsByPage:", Object.keys(this.questionsByPage));
            } else {
                console.log(`No saved questions found for file: ${fileId}`);
            }
        } catch (error) {
            console.error('Error loading questions from storage:', error);
        }
    }

    saveQuestionsToStorage() {
        try {
            // Only save if we have a file ID
            if (!this.appController.currentFileId) return;

            // Prepare data for storage by removing DOM elements
            const storageData = {};

            Object.keys(this.questionsByPage).forEach(pageId => {
                storageData[pageId] = this.questionsByPage[pageId].map(item => {
                    // Create a new object without the element property
                    const { element, ...rest } = item;
                    return rest;
                });
            });

            // Save to localStorage
            const storageKey = `studyflow_questions_${this.appController.currentFileId}`;
            localStorage.setItem(storageKey, JSON.stringify(storageData));
            console.log(`Saved questions to storage for file: ${this.appController.currentFileId}`);
        } catch (error) {
            console.error('Error saving questions to storage:', error);
        }
    }

    onPageChanged(page) {
        // Update current page ID, ensure it's a string for consistent comparison
        const newPageId = String(page.page_number);

        // Only update if actually changed
        if (newPageId !== this.currentPageId) {
            console.log(`Switched to page: ${newPageId} (was: ${this.currentPageId})`);
            this.currentPageId = newPageId;

            // Display questions for this page
            this.displayQuestionsForCurrentPage();

            // Explicitly check if we need to reload questions
            if (Object.keys(this.questionsByPage).length === 0) {
                console.log("No questions found for any page, attempting to reload from storage");
                this.loadQuestionsFromStorage();
            }
        }
    }

    displayQuestionsForCurrentPage() {
        // Clear the QA history
        this.elements.qaHistory.innerHTML = '';

        // Add page indicator at the top
        const pageIndicator = document.createElement('div');
        pageIndicator.className = 'page-indicator mb-3 p-2 bg-indigo-100 rounded text-sm text-center';
        pageIndicator.textContent = `Questions for Page ${this.currentPageId}`;
        this.elements.qaHistory.appendChild(pageIndicator);

        // Get questions for current page - ensure we use string comparison
        const pageIdString = String(this.currentPageId);
        console.log(`Looking for questions for page: ${pageIdString}`);
        console.log(`Available pages with questions: ${Object.keys(this.questionsByPage).join(', ') || 'none'}`);

        const pageQuestions = this.questionsByPage[pageIdString] || [];
        console.log(`Found ${pageQuestions.length} questions for page ${pageIdString}`);

        if (pageQuestions.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state text-gray-500 text-center p-4';
            emptyState.textContent = 'No questions yet for this page. Ask something!';
            this.elements.qaHistory.appendChild(emptyState);
        } else {
            // Display them in order
            pageQuestions.forEach(item => {
                if (item && item.element) {
                    this.elements.qaHistory.appendChild(item.element);
                } else {
                    console.warn('Invalid question item found for page', pageIdString, item);
                }
            });
        }
    }

    async loadAvailableModels() {
        try {
            const response = await fetch('/api/models');
            if (response.ok) {
                const data = await response.json();
                this.models = data.models;
                this.selectedModel = data.default_qa_model;
                this.createModelSelector();
            }
        } catch (error) {
            console.error('Error loading AI models:', error);
        }
    }

    createModelSelector() {
        // Only create if we have models and the selector doesn't exist yet
        if (!this.models || document.getElementById('model-selector')) {
            return;
        }

        // Create a model selector dropdown
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'model-selector-container flex items-center mb-2 text-xs';
        selectorContainer.innerHTML = `
            <label for="model-selector" class="mr-2 text-gray-700">Model:</label>
            <select id="model-selector" class="p-1 border rounded text-xs">
                ${Object.keys(this.models).map(model => `
                    <option value="${model}" ${model === this.selectedModel ? 'selected' : ''}>
                        ${model}
                    </option>
                `).join('')}
            </select>
            <div class="ml-2 text-gray-500 model-info"></div>
        `;

        // Insert before the question input
        const qaContainer = this.elements.questionInput.parentElement;
        qaContainer.insertBefore(selectorContainer, this.elements.questionInput);

        // Add event listener for model change
        const selector = document.getElementById('model-selector');
        const modelInfo = selectorContainer.querySelector('.model-info');

        // Update model info initially
        this.updateModelInfo(modelInfo, this.selectedModel);

        // Update when selection changes
        selector.addEventListener('change', () => {
            this.selectedModel = selector.value;
            this.updateModelInfo(modelInfo, this.selectedModel);
        });
    }

    updateModelInfo(infoElement, modelName) {
        if (this.models && this.models[modelName]) {
            const model = this.models[modelName];
            infoElement.textContent = `${model.description} - ${model.cost_per_1k}/1K tokens`;
        }
    }

    askQuestion() {
        const question = this.elements.questionInput.value.trim();
        if (!question) return;

        // Get the current page ID from the appController - ensure it's a string
        const pageId = String(this.appController.documentViewer?.currentPageId || this.currentPageId);
        const fileId = this.appController.currentFileId;

        console.log(`Asking question for page: ${pageId}, file: ${fileId}`);

        // Add the question to the history
        const questionElement = document.createElement('div');
        questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg mb-3';
        questionElement.innerHTML = `
            <p class="font-semibold">You: ${question}</p>
            <div class="answer mt-2">
                <p class="text-gray-500">Loading answer...</p>
            </div>
        `;

        // Create a question entry
        const questionEntry = {
            question,
            pageId,
            fileId,
            timestamp: new Date().toISOString(),
            element: questionElement,
            model: this.selectedModel
        };

        // Initialize the array for this page if it doesn't exist
        if (!this.questionsByPage[pageId]) {
            this.questionsByPage[pageId] = [];
        }

        // Add to the questions array for this page
        this.questionsByPage[pageId].push(questionEntry);
        console.log(`Added question to page ${pageId}. Total questions for this page: ${this.questionsByPage[pageId].length}`);

        // Add to the current display
        this.elements.qaHistory.appendChild(questionElement);

        // Clear the input
        this.elements.questionInput.value = '';

        // Scroll to the bottom of the history
        this.elements.qaHistory.scrollTop = this.elements.qaHistory.scrollHeight;

        // Make API call asynchronously
        this.fetchAnswer(questionEntry);
    }

    async fetchAnswer(questionEntry) {
        try {
            // Make API call to get the answer
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: questionEntry.question,
                    file_id: questionEntry.fileId,
                    page_id: questionEntry.pageId,
                    model: this.selectedModel
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get answer');
            }

            const data = await response.json();

            // Skip updating if element no longer exists (user may have navigated away)
            if (!questionEntry.element || !questionEntry.element.isConnected) {
                console.log('Question element no longer in DOM, skipping update');

                // Still update our data structure
                questionEntry.answer = data.answer;
                questionEntry.modelUsed = data.model_used || this.selectedModel || 'AI';
                this.saveQuestionsToStorage();
                return;
            }

            const answerElement = questionEntry.element.querySelector('.answer');
            if (!answerElement) {
                console.warn('Answer element not found within question element');
                return;
            }

            // Add model info to the answer if provided
            const modelUsed = data.model_used || this.selectedModel || 'AI';
            answerElement.innerHTML = `
                <p>${data.answer}</p>
                <p class="text-xs text-gray-500 mt-1">Answered using ${modelUsed}</p>
            `;

            // Store the answer in our data structure
            questionEntry.answer = data.answer;
            questionEntry.modelUsed = modelUsed;

            // Save updated questions to storage
            this.saveQuestionsToStorage();
            console.log(`Saved new question for page ${questionEntry.pageId}`);

        } catch (error) {
            console.error('Error asking question:', error);

            // Skip updating if element no longer exists
            if (!questionEntry.element || !questionEntry.element.isConnected) {
                console.log('Question element no longer in DOM, skipping error update');

                // Still update our data structure
                questionEntry.error = true;
                this.saveQuestionsToStorage();
                return;
            }

            const answerElement = questionEntry.element.querySelector('.answer');
            if (answerElement) {
                answerElement.innerHTML = `<p class="text-red-500">Error: Failed to get an answer. Please try again.</p>`;
            }

            // Store the error in our data structure
            questionEntry.error = true;

            // Save updated questions to storage
            this.saveQuestionsToStorage();
        }
    }

    logStorageStatus() {
        try {
            // Check if localStorage is available and working
            const testKey = 'studyflow_storage_test';
            localStorage.setItem(testKey, 'test');
            const testValue = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);

            console.log(`Storage test: ${testValue === 'test' ? 'PASSED' : 'FAILED'}`);

            // List all studyflow related items in storage
            const studyflowItems = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('studyflow_')) {
                    studyflowItems.push({
                        key,
                        size: localStorage.getItem(key).length
                    });
                }
            }

            console.log(`Found ${studyflowItems.length} StudyFlow items in localStorage:`);
            studyflowItems.forEach(item => {
                console.log(`- ${item.key} (${item.size} bytes)`);
            });
        } catch (error) {
            console.error('Storage test failed:', error);
        }
    }

    // Add a utility method to force reload and display of questions
    forceReloadQuestions() {
        this.questionsByPage = {}; // Clear existing questions
        this.loadQuestionsFromStorage();
        this.displayQuestionsForCurrentPage();
    }

    // Add a method to explicitly initialize with current file and page
    initializeWithCurrentFile(fileId, pageId) {
        if (fileId) {
            console.log(`QAHandler explicitly initializing with file: ${fileId}, page: ${pageId || 'default'}`);
            // Clear any existing questions
            this.questionsByPage = {};
            // Set current page if provided
            if (pageId) {
                this.currentPageId = String(pageId);
            }
            // Load questions for this file from storage
            this.loadQuestionsFromStorage();
            // Show the questions for current page
            this.displayQuestionsForCurrentPage();
            return true;
        }
        return false;
    }
} 