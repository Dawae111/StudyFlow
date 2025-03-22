/**
 * Test script for PDF navigation and question persistence
 * 
 * This is a debugging script that can be included in development mode
 * to test if page navigation and question persistence is working properly.
 */

(function () {
    console.log("📝 StudyFlow Test Navigation script loaded");

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function () {
        // Track page changes
        let pageChangeCount = 0;

        document.addEventListener('pageChanged', (e) => {
            pageChangeCount++;
            console.log(`📄 Page Change #${pageChangeCount}: Switched to page ${e.detail.pageId}`);
            console.log('   Page details:', e.detail.page);

            // Check if QA history for this page exists
            setTimeout(() => {
                const qaHistory = document.getElementById('qa-history');
                if (qaHistory) {
                    console.log(`   QA History has ${qaHistory.children.length} items (including header)`);

                    // Check localStorage for questions on this page
                    const appController = window.appController;
                    if (appController && appController.currentFileId) {
                        const storageKey = `studyflow_questions_${appController.currentFileId}`;
                        const savedData = localStorage.getItem(storageKey);

                        if (savedData) {
                            try {
                                const parsedData = JSON.parse(savedData);
                                const pageId = String(e.detail.pageId);
                                const pageQuestions = parsedData[pageId] || [];
                                console.log(`   Found ${pageQuestions.length} stored questions for this page`);
                            } catch (error) {
                                console.error('   Error parsing saved questions:', error);
                            }
                        } else {
                            console.log('   No saved questions found in localStorage');
                        }
                    }
                }
            }, 500);
        });

        // Expose functions to test button navigation
        window.testNavigateToPage = function (pageNumber) {
            const appController = window.appController;
            if (!appController || !appController.documentViewer) {
                return 'App controller or document viewer not found';
            }

            const viewer = appController.documentViewer;
            if (!viewer.documentData || !viewer.documentData.pages ||
                pageNumber < 1 || pageNumber > viewer.documentData.pages.length) {
                return `Invalid page number: ${pageNumber}. Document has ${viewer.documentData?.pages?.length || 0} pages.`;
            }

            console.log(`🔍 Testing navigation to page ${pageNumber}`);
            viewer.currentPageId = pageNumber;
            viewer.renderCurrentPage();
            viewer.updateActiveThumbnail();
            viewer.navigateToPdfPage(pageNumber);
            return `Navigated to page ${pageNumber}`;
        };

        // Expose a test function to force question reload
        window.testForceReloadQuestions = function () {
            const appController = window.appController;
            if (appController && appController.qaHandler) {
                console.log('🔄 Forcing reload of questions...');
                appController.qaHandler.forceReloadQuestions();
                return 'Questions reloaded';
            }
            return 'QA Handler not found';
        };

        // Expose a test function to add a test question to current page
        window.testAddQuestion = function (question = 'Test question ' + new Date().toISOString()) {
            const appController = window.appController;
            if (appController && appController.qaHandler) {
                const qaHandler = appController.qaHandler;

                // Directly set the question input value
                const questionInput = document.getElementById('question-input');
                if (questionInput) {
                    questionInput.value = question;

                    // Trigger the ask button click
                    const askButton = document.getElementById('ask-button');
                    if (askButton) {
                        askButton.click();
                        return `Added test question: "${question}"`;
                    }
                }
            }
            return 'Could not add test question';
        };

        console.log('📝 Test navigation script initialized. Available test functions:');
        console.log('   - testNavigateToPage(pageNumber)');
        console.log('   - testForceReloadQuestions()');
        console.log('   - testAddQuestion("Your test question")');
    });
})(); 