import { api } from './api.js';

export class PracticeHandler {
    constructor() {
        this.currentDocumentId = null;
        this.questions = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Tab switching
        document.getElementById('tab-practice').addEventListener('click', () => {
            this.showPracticeTab();
        });

        // Generate question button
        document.getElementById('generate-question').addEventListener('click', () => {
            this.generateNewQuestion();
        });
    }

    showPracticeTab() {
        // Hide all other tabs
        document.getElementById('summary-content').classList.add('hidden');
        document.getElementById('qa-content').classList.add('hidden');
        document.getElementById('notes-content').classList.add('hidden');

        // Show practice tab
        document.getElementById('practice-content').classList.remove('hidden');

        // Update tab button styles
        document.getElementById('tab-summary').classList.remove('bg-indigo-600', 'text-white');
        document.getElementById('tab-summary').classList.add('bg-gray-200', 'text-gray-700');
        document.getElementById('tab-qa').classList.remove('bg-indigo-600', 'text-white');
        document.getElementById('tab-qa').classList.add('bg-gray-200', 'text-gray-700');
        document.getElementById('tab-notes').classList.remove('bg-indigo-600', 'text-white');
        document.getElementById('tab-notes').classList.add('bg-gray-200', 'text-gray-700');
        document.getElementById('tab-practice').classList.remove('bg-gray-200', 'text-gray-700');
        document.getElementById('tab-practice').classList.add('bg-indigo-600', 'text-white');
    }

    async generateNewQuestion() {
        try {
            const response = await api.generatePracticeQuestion(this.currentDocumentId);
            if (response.success) {
                this.addQuestion(response.data);
            } else {
                console.error('Failed to generate practice question:', response.error);
            }
        } catch (error) {
            console.error('Error generating practice question:', error);
        }
    }

    addQuestion(questionData) {
        const questionsContainer = document.getElementById('practice-questions');
        const questionElement = this.createQuestionElement(questionData);
        questionsContainer.insertBefore(questionElement, questionsContainer.firstChild);
        this.questions.unshift(questionData);
    }

    createQuestionElement(questionData) {
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg shadow-sm border';

        div.innerHTML = `
            <div class="space-y-3">
                <p class="font-medium">${questionData.question}</p>
                <div class="space-y-2">
                    ${questionData.options.map((option, index) => `
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="radio" name="q${questionData.id}" value="${index}" 
                                class="form-radio text-indigo-600">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
                <button class="check-answer mt-2 bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition text-sm">
                    Check Answer
                </button>
                <div class="answer-feedback hidden mt-2 p-2 rounded"></div>
            </div>
        `;

        // Add event listener for checking answer
        const checkButton = div.querySelector('.check-answer');
        const feedbackDiv = div.querySelector('.answer-feedback');

        checkButton.addEventListener('click', () => {
            const selectedAnswer = div.querySelector(`input[name="q${questionData.id}"]:checked`);
            if (!selectedAnswer) {
                feedbackDiv.textContent = 'Please select an answer';
                feedbackDiv.classList.remove('hidden', 'bg-green-100', 'bg-red-100');
                feedbackDiv.classList.add('bg-yellow-100');
                return;
            }

            const isCorrect = parseInt(selectedAnswer.value) === questionData.correctAnswer;
            feedbackDiv.textContent = isCorrect ? 'Correct!' : 'Incorrect. Try again!';
            feedbackDiv.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');
            feedbackDiv.classList.add(isCorrect ? 'bg-green-100' : 'bg-red-100');
        });

        return div;
    }

    setCurrentDocument(documentId) {
        this.currentDocumentId = documentId;
        // Clear previous questions when switching documents
        document.getElementById('practice-questions').innerHTML = '';
        this.questions = [];
    }
} 