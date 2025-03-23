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

                            // Recreate the element - we'll create a fresh one each time
                            const questionElement = document.createElement('div');
                            questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg mb-3';

                            // Format HTML based on whether we have an answer or error
                            if (item.error) {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">Q: ${item.question}</p>
                                    <div class="answer mt-2">
                                        <p class="text-red-500">Error: Failed to get an answer. Please try again.</p>
                                    </div>
                                `;
                            } else if (item.answer) {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">Q: ${item.question}</p>
                                    <div class="answer mt-2">
                                        <p>A: ${item.answer}</p>
                                        <p class="text-xs text-gray-500 mt-1">Answered using ${item.modelUsed || 'AI'}</p>
                                    </div>
                                `;
                            } else {
                                questionElement.innerHTML = `
                                    <p class="font-semibold">Q: ${item.question}</p>
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
        if (!page) {
            console.warn('Page changed event received with no page data');
            return;
        }

        // Update current page ID, ensure it's a string for consistent comparison
        const newPageId = String(page.page_number);
        console.log(`QAHandler: Page changed to ${newPageId}`);

        // Always update the current page ID
        this.currentPageId = newPageId;

        // Display questions for this page (loadQuestionsFromStorage is not needed on every page change)
        this.displayQuestionsForCurrentPage();
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

        // Double check if we need to reload from storage
        if (Object.keys(this.questionsByPage).length === 0) {
            console.log('No questions in memory, loading from storage first');
            this.loadQuestionsFromStorage();
        }

        // IMPORTANT: Get questions AFTER potentially loading from storage
        const pageQuestions = this.questionsByPage[pageIdString] || [];
        console.log(`Found ${pageQuestions.length} questions for page ${pageIdString}`);
        console.log('Questions in memory:', pageQuestions);

        // DEBUGGING: Log detailed question info
        if (pageQuestions.length > 0) {
            pageQuestions.forEach((item, i) => {
                console.log(`Question ${i + 1}: ${item.question ? item.question.substring(0, 30) : 'NO QUESTION'}`);
            });
        }

        // Check if there are any valid questions
        const hasValidQuestions = pageQuestions.length > 0 && pageQuestions.some(q => q && q.question);

        if (!hasValidQuestions) {
            console.log('No valid questions found, showing empty state');
            // Only show empty state if there are no questions
            const emptyState = document.createElement('div');
            emptyState.id = 'qa-empty-state';
            emptyState.className = 'empty-state text-gray-500 text-center p-4';
            emptyState.textContent = 'No questions yet for this page. Ask something!';
            this.elements.qaHistory.appendChild(emptyState);
        } else {
            console.log(`Displaying ${pageQuestions.length} questions for page ${pageIdString}`);
            // Display them in order
            pageQuestions.forEach((item, index) => {
                if (item && item.question) {
                    // Create a new element for the question (don't use cloneNode which might have issues)
                    const questionElement = document.createElement('div');
                    questionElement.id = `question-${pageIdString}-${index}`;
                    questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg mb-3';

                    // Create the inner HTML based on question state
                    if (item.error) {
                        questionElement.innerHTML = `
                            <p class="font-semibold">Q: ${item.question}</p>
                            <div class="answer mt-2">
                                <p class="text-red-500">Error: Failed to get an answer. Please try again.</p>
                            </div>
                        `;
                    } else if (item.answer) {
                        questionElement.innerHTML = `
                            <p class="font-semibold">Q: ${item.question}</p>
                            <div class="answer mt-2">
                                <p>A: ${item.answer}</p>
                                <p class="text-xs text-gray-500 mt-1">Answered using ${item.modelUsed || 'AI'}</p>
                            </div>
                        `;
                    } else {
                        questionElement.innerHTML = `
                            <p class="font-semibold">Q: ${item.question}</p>
                            <div class="answer mt-2">
                                <p class="text-gray-500">Loading answer...</p>
                            </div>
                        `;
                    }

                    this.elements.qaHistory.appendChild(questionElement);
                } else {
                    console.warn('Invalid question item found for page', pageIdString, item);
                }
            });
        }

        // Double-check that we don't have both questions and empty state
        if (hasValidQuestions) {
            const emptyState = document.getElementById('qa-empty-state');
            if (emptyState) {
                console.log('Removing empty state - we have questions!');
                emptyState.remove();
            }
        }
    }

    async loadAvailableModels() {
        try {
            console.log('Loading available AI models...');
            const response = await fetch('/api/models');

            if (!response.ok) {
                console.error(`Error loading models: ${response.status}`);
                return;
            }

            const data = await response.json();
            console.log('Available models:', data);

            this.models = data.models;

            // Try to get user's preferred model from localStorage
            const savedModel = localStorage.getItem('studyflow_preferred_model');

            // Use saved model if it exists and is valid, otherwise use default
            if (savedModel && this.models[savedModel]) {
                console.log(`Using saved model preference: ${savedModel}`);
                this.selectedModel = savedModel;
            } else {
                this.selectedModel = data.default_qa_model;
                console.log(`Using default model: ${this.selectedModel}`);
            }

            this.createModelSelector();
        } catch (error) {
            console.error('Error loading AI models:', error);
        }
    }

    createModelSelector() {
        // Only create if we have models and the selector doesn't exist yet
        if (!this.models || document.getElementById('model-selector')) {
            return;
        }

        // Create a more compact model selector dropdown like OpenAI's UI
        const selectorContainer = document.createElement('div');
        selectorContainer.className = 'model-selector-container mb-2 relative';

        // Create a dropdown button that shows the current model
        const buttonHTML = `
            <button id="model-dropdown-btn" class="flex items-center justify-between w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-2 rounded text-sm">
                <span id="current-model-name">${this.selectedModel}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div id="model-dropdown-content" class="hidden absolute bottom-full left-0 right-0 z-50 mb-2 bg-white shadow-lg rounded-md border border-gray-200 py-1 max-h-48 overflow-y-auto">
                ${Object.keys(this.models).map(model => `
                    <div class="model-option cursor-pointer p-2 hover:bg-gray-100 ${model === this.selectedModel ? 'selected' : ''}" data-model="${model}">
                        <div class="font-medium">${model}</div>
                        <div class="text-xs text-gray-500">${this.models[model].description}</div>
                    </div>
                `).join('')}
            </div>
        `;

        selectorContainer.innerHTML = buttonHTML;

        // Insert before the question input
        const qaContainer = this.elements.questionInput.parentElement;
        qaContainer.insertBefore(selectorContainer, this.elements.questionInput);

        // Add event listeners for dropdown functionality
        const dropdownBtn = document.getElementById('model-dropdown-btn');
        const dropdownContent = document.getElementById('model-dropdown-content');

        // Toggle dropdown when button is clicked
        dropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdownBtn.classList.toggle('active');
            dropdownContent.classList.toggle('hidden');

            // For animation, add the show class after removing hidden
            if (!dropdownContent.classList.contains('hidden')) {
                // Small delay for the animation to work properly
                setTimeout(() => {
                    dropdownContent.classList.add('show');
                }, 10);
            } else {
                dropdownContent.classList.remove('show');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!selectorContainer.contains(e.target)) {
                dropdownContent.classList.add('hidden');
            }
        });

        // Add event listeners to model options
        document.querySelectorAll('.model-option').forEach(option => {
            option.addEventListener('click', () => {
                const previousModel = this.selectedModel;
                this.selectedModel = option.dataset.model;

                // Update the button text
                document.getElementById('current-model-name').textContent = this.selectedModel;

                // Update selected state in dropdown
                document.querySelectorAll('.model-option').forEach(opt => {
                    if (opt.dataset.model === this.selectedModel) {
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });

                // Hide dropdown
                dropdownContent.classList.add('hidden');

                // Log model change and save preference
                console.log(`Model changed from ${previousModel} to ${this.selectedModel}`);

                try {
                    localStorage.setItem('studyflow_preferred_model', this.selectedModel);
                    console.log(`Saved user model preference: ${this.selectedModel}`);
                } catch (e) {
                    console.warn('Could not save model preference:', e);
                }
            });
        });
    }

    askQuestion() {
        const question = this.elements.questionInput.value.trim();
        if (!question) return;

        // Remove the empty state message if it exists
        const emptyState = document.getElementById('qa-empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Get the current page ID from the appController - ensure it's a string
        // First try to get it from the document viewer, then fallback to our stored value
        let pageId;
        if (this.appController && this.appController.documentViewer) {
            pageId = String(this.appController.documentViewer.currentPageId);
        } else {
            pageId = String(this.currentPageId);
        }

        const fileId = this.appController.currentFileId;
        console.log(`Asking question for page: ${pageId}, file: ${fileId}`);

        // Add the question to the history
        const questionElement = document.createElement('div');
        questionElement.className = 'question-container p-4 bg-gray-50 rounded-lg mb-3';
        questionElement.innerHTML = `
            <p class="font-semibold">Q: ${question}</p>
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

        // Save updated questions to storage immediately to prevent loss
        this.saveQuestionsToStorage();

        // Make API call asynchronously
        this.fetchAnswer(questionEntry);
    }

    async fetchAnswer(questionEntry) {
        try {
            // Log the model being used
            console.log(`🧠 Asking question with model: ${this.selectedModel}`);

            // Prepare the request payload
            const payload = {
                question: questionEntry.question,
                file_id: questionEntry.fileId,
                page_id: questionEntry.pageId,
                model: this.selectedModel
            };

            console.log('📤 Sending request payload:', payload);

            // Make API call to get the answer
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API error: ${response.status} - ${errorText}`);
                throw new Error(`Failed to get answer: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📥 Received response:', {
                answer_length: data.answer?.length || 0,
                model_used: data.model_used || 'unknown'
            });

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
                <p>A: ${data.answer}</p>
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

    // Helper method to check if a page has questions
    hasQuestionsForPage(pageId) {
        const pageIdString = String(pageId);
        return this.questionsByPage[pageIdString] && this.questionsByPage[pageIdString].length > 0;
    }
}