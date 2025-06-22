import * as store from './store.js';
import * as ui from './ui.js';
import { analyzeImage } from './api.js';
import { getRatingLabel } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        uploadArea: document.getElementById('upload-area'),
        fileInput: document.getElementById('file-input'),
        previewContainer: document.getElementById('preview-container'),
        startAnalysisBtn: document.getElementById('start-analysis-btn'),
        changeImageBtn: document.getElementById('change-image-btn'),
        disclaimer: document.getElementById('disclaimer'),
        closeDisclaimerBtn: document.getElementById('close-disclaimer'),
        tryAgainBtn: document.getElementById('try-again'),
        viewSavedBtn: document.getElementById('view-saved'),
        container: document.querySelector('.container'),
        resultContainer: document.getElementById('result-container'),
        imagePreviewContainerResult: document.getElementById('image-preview-container-result'),
        imagePreviewContainer: document.querySelector('.image-preview-container')
    };

    let currentAnalysisResult = null;
    let isSavedResultsVisible = false;
    let selectedImageDataUrl = null;

    // --- Initialization ---
    function initialize() {
        setupEventListeners();
    }

    // --- Event Handlers ---
async function handleFileSelect() { // 注意：函数现在是 async 的
    if (!elements.fileInput.files.length) return;

    const file = elements.fileInput.files[0];
    if (!file.type.startsWith('image/')) {
        alert('请选择一个图片文件');
        return;
    }

    console.log(`原始图片: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // --- 压缩配置 ---
    const options = {
        maxSizeMB: 1,      // 核心：图片最大体积（MB），超过则压缩
        maxWidthOrHeight: 1920, // 核心：图片最大宽度或高度
        useWebWorker: true,   // 使用Web Worker，避免压缩时UI卡顿
        onProgress: (p) => {  // 提供压缩进度的回调
            console.log(`压缩进度: ${p}%`);
            // 在这里可以更新UI，显示压缩进度
            ui.updateLoadingText(`正在压缩图片... ${p.toFixed(0)}%`);
        },
    };

    try {
        // 显示一个临时的加载状态，告知用户正在压缩
        ui.showCompressionLoading();

        // 调用压缩库
        const compressedFile = await imageCompression(file, options);
        
        console.log(`压缩后图片大小: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        // 使用压缩后的文件进行后续操作
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImageDataUrl = e.target.result;
            ui.showPreview(selectedImageDataUrl);
        };
        reader.readAsDataURL(compressedFile);

    } catch (error) {
        console.error('图片压缩失败:', error);
        alert(`图片压缩失败: ${error.message}`);
        ui.resetToUpload(); // 如果压缩失败，重置回上传界面
    }
}

    async function handleStartAnalysis() {
        if (!selectedImageDataUrl) return;

        ui.showLoading(selectedImageDataUrl);

        try {
            const aiType = document.querySelector('input[name="ai-type"]:checked').value;
            const response = await analyzeImage(selectedImageDataUrl, aiType);
            currentAnalysisResult = { ...response, image: selectedImageDataUrl, aiType };
            
            // A short delay to make the loading feel more deliberate
            setTimeout(() => {
                ui.displayResult(currentAnalysisResult);
                ui.createSaveButton(handleSaveResult);
                ui.createShareButton(handleShareResult);
            }, 500);

        } catch (error) {
            console.error('分析图片时出错:', error);
            ui.displayError('出错了，请重新上传图片或刷新页面。检查控制台获取详细信息。');
        }
    }
    
    function handleSaveResult() {
        if (currentAnalysisResult) {
            store.addSavedResult({ ...currentAnalysisResult, timestamp: new Date().toISOString() });
            if (isSavedResultsVisible) {
                renderSaved();
            }
        }
    }

    function handleShareResult() {
        if (!currentAnalysisResult) return;
        const { rating, verdict, explanation } = currentAnalysisResult;
        const ratingLabel = getRatingLabel(rating);
        const textToCopy = `我的图片AI评分结果:\n\n verdict: ${verdict}\n rating: ${ratingLabel} (${rating}/10)\n explanation: "${explanation}"\n\n你也来试试吧！`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            console.log('Result copied to clipboard!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
            alert('复制失败');
        });
    }
    
    function handleDeleteResult(index) {
        store.deleteSavedResult(index);
        renderSaved();
    }

    function handleViewSavedResult(index) {
        const result = store.getSavedResults()[index];
        ui.showPopup(result);
    }
    
    async function handleTryAgain() {
        if (selectedImageDataUrl) {
            await handleStartAnalysis();
        } else {
            ui.resetToUpload();
            currentAnalysisResult = null;
        }
    }

    function handleChangeImage() {
        elements.fileInput.click();
    }
    
    function toggleSavedResults() {
        const existingContainer = document.querySelector('.saved-results');
        if (existingContainer) {
            existingContainer.remove();
            elements.viewSavedBtn.textContent = '📁 查看保存的结果';
            isSavedResultsVisible = false;
        } else {
            renderSaved();
            elements.viewSavedBtn.textContent = '📁 隐藏保存的结果';
            isSavedResultsVisible = true;
        }
    }
    
    function renderSaved() {
        const results = store.getSavedResults();
        const savedContainer = ui.createSavedResultsContainer(results, {
            onDelete: handleDeleteResult,
            onView: handleViewSavedResult,
        });
        
        const existingContainer = document.querySelector('.saved-results');
        if (existingContainer) existingContainer.remove();
        
        elements.container.appendChild(savedContainer);
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        const imageDropZones = [elements.uploadArea, elements.imagePreviewContainer, elements.imagePreviewContainerResult];
        
        imageDropZones.forEach(zone => {
            if (zone) { // Add a check to ensure the element exists
                zone.addEventListener('click', () => elements.fileInput.click());
                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    zone.classList.add('drag-over');
                });
                zone.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    zone.classList.remove('drag-over');
                });
                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.classList.remove('drag-over');
                    if (e.dataTransfer.files.length) {
                        elements.fileInput.files = e.dataTransfer.files;
                        handleFileSelect();
                    }
                });
            }
        });

        elements.fileInput.addEventListener('change', handleFileSelect);
        
        elements.startAnalysisBtn.addEventListener('click', handleStartAnalysis);
        elements.changeImageBtn.addEventListener('click', handleChangeImage);
        elements.closeDisclaimerBtn.addEventListener('click', () => ui.hideDisclaimer());
        elements.tryAgainBtn.addEventListener('click', handleTryAgain);
        elements.viewSavedBtn.addEventListener('click', toggleSavedResults);
    }

    // --- Start Application ---
    initialize();
});
