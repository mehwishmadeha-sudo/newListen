// Real-time Chat App - Optimized for Production
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, collection, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCA8BBWeyZJE64x3p8oTBf-7Ltf4Z9dSko",
    authDomain: "newlisten-7c09c.firebaseapp.com",
    projectId: "newlisten-7c09c",
    storageBucket: "newlisten-7c09c.firebasestorage.app",
    messagingSenderId: "615054680789",
    appId: "1:615054680789:web:a2e6e68eec594ffc88785c",
    measurementId: "G-3M8HC1HP8G"
};

// Font mappings
const FONTS = {
    monospace: "'Courier New', monospace",
    noto: "'Noto Nastaliq Urdu', serif"
};

// Firebase Service
class FirebaseService {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.userId = window.CHAT_USER_ID || 'user1';
        this.otherUserId = window.CHAT_OTHER_USER_ID || 'user2';
        this.lastUpdateTime = 0;
        this.debounceDelay = 50; // 50ms debounce for faster updates
    }

    listenToMessages(callback) {
        const messagesQuery = query(collection(this.db, 'messages'), orderBy('timestamp'));
        return onSnapshot(messagesQuery, callback);
    }

    listenToTyping(callback) {
        return onSnapshot(doc(this.db, 'typing', this.otherUserId), callback);
    }

    listenToPreferences(callback) {
        return onSnapshot(doc(this.db, 'preferences', 'shared'), callback);
    }

    async updateTyping(text, cursorPosition, selectionStart, selectionEnd) {
        const now = Date.now();
        
        // Debounce updates for performance
        if (now - this.lastUpdateTime < this.debounceDelay) {
            return;
        }
        this.lastUpdateTime = now;

        try {
            if (text.length > 0) {
                await setDoc(doc(this.db, 'typing', this.userId), {
                    isTyping: true,
                    text: text,
                    cursorPosition: cursorPosition || text.length,
                    selectionStart: selectionStart || cursorPosition || text.length,
                    selectionEnd: selectionEnd || cursorPosition || text.length,
                    timestamp: now
                }, { merge: true });
            } else {
                await deleteDoc(doc(this.db, 'typing', this.userId));
            }
        } catch (error) {
            console.log('Update error:', error);
        }
    }

    async updatePreferences(font, fontSize) {
        try {
            await setDoc(doc(this.db, 'preferences', 'shared'), {
                font: font,
                fontSize: fontSize,
                updatedBy: this.userId,
                timestamp: Date.now()
            }, { merge: true });
        } catch (error) {
            console.log('Preferences update error:', error);
        }
    }

    async loadPreferences() {
        try {
            const prefsDoc = await getDoc(doc(this.db, 'preferences', 'shared'));
            if (prefsDoc.exists()) {
                return prefsDoc.data();
            }
        } catch (error) {
            console.log('Load preferences error:', error);
        }
        return { font: 'monospace', fontSize: 20 };
    }

    async loadPersistedText() {
        try {
            const typingDoc = await getDoc(doc(this.db, 'typing', this.userId));
            if (typingDoc.exists()) {
                const data = typingDoc.data();
                return data.text || '';
            }
        } catch (error) {
            console.log('Load error:', error);
        }
        return '';
    }

    async cleanup() {
        try {
            await deleteDoc(doc(this.db, 'typing', this.userId));
        } catch (error) {
            console.log('Cleanup error:', error);
        }
    }
}

// UI Controller
class UIController {
    constructor() {
        this.otherMessagesDisplay = document.getElementById('otherMessagesDisplay');
    }

    displayMessages(snapshot, userId) {
        let otherText = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.userId !== userId) {
                otherText += data.text + '\n';
            }
        });
        this.otherMessagesDisplay.textContent = otherText.trim();
        this.scrollToBottom();
    }

    displayTyping(doc) {
        if (doc.exists()) {
            const data = doc.data();
            if (data.isTyping) {
                this.displayTextWithCursorAndSelection(
                    data.text, 
                    data.cursorPosition || data.text.length,
                    data.selectionStart || data.cursorPosition || data.text.length,
                    data.selectionEnd || data.cursorPosition || data.text.length
                );
            } else {
                this.displayTextWithCursorAndSelection('', 0, 0, 0);
            }
        } else {
            this.displayTextWithCursorAndSelection('', 0, 0, 0);
        }
        this.scrollToBottom();
    }

    displayTextWithCursorAndSelection(text, cursorPosition, selectionStart, selectionEnd) {
        let html = '';
        
        if (selectionStart !== selectionEnd) {
            const start = Math.min(selectionStart, selectionEnd);
            const end = Math.max(selectionStart, selectionEnd);
            const beforeSelection = text.substring(0, start);
            const selectedText = text.substring(start, end);
            const afterSelection = text.substring(end);
            
            html = this.escapeHtml(beforeSelection) + 
                   '<span class="live-selection">' + this.escapeHtml(selectedText) + '</span>' +
                   this.escapeHtml(afterSelection);
        } else {
            const beforeCursor = text.substring(0, cursorPosition);
            const afterCursor = text.substring(cursorPosition);
            html = this.escapeHtml(beforeCursor) + '<span class="live-cursor"></span>' + this.escapeHtml(afterCursor);
        }
        
        this.otherMessagesDisplay.innerHTML = html;
    }

    updateFont(fontType) {
        const fontFamily = FONTS[fontType] || FONTS.monospace;
        document.documentElement.style.setProperty('--font-family', fontFamily);
    }

    updateFontSize(fontSize) {
        document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.otherMessagesDisplay.scrollTop = this.otherMessagesDisplay.scrollHeight;
    }
}

// Preferences Controller
class PreferencesController {
    constructor(firebaseService, uiController) {
        this.firebaseService = firebaseService;
        this.uiController = uiController;
        this.overlay = document.getElementById('preferencesOverlay');
        this.selectedFont = 'monospace';
        this.selectedSize = 20;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Preferences button
        document.getElementById('preferencesButton').addEventListener('click', () => {
            this.openPreferences();
        });

        // Font option selection
        document.querySelectorAll('.font-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectFont(option.dataset.font);
            });
        });

        // Text size slider
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        
        sizeSlider.addEventListener('input', (e) => {
            this.selectedSize = parseInt(e.target.value);
            sizeValue.textContent = this.selectedSize;
        });

        // Action buttons
        document.getElementById('cancelPreferences').addEventListener('click', () => {
            this.closePreferences();
        });

        document.getElementById('applyPreferences').addEventListener('click', () => {
            this.applyPreferences();
        });

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.closePreferences();
            }
        });
    }

    openPreferences() {
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closePreferences() {
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    selectFont(fontType) {
        this.selectedFont = fontType;
        
        // Update UI selection
        document.querySelectorAll('.font-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-font="${fontType}"]`).classList.add('selected');
    }

    async applyPreferences() {
        await this.firebaseService.updatePreferences(this.selectedFont, this.selectedSize);
        this.uiController.updateFont(this.selectedFont);
        this.uiController.updateFontSize(this.selectedSize);
        this.closePreferences();
    }

    updateCurrentSelection(fontType, fontSize) {
        this.selectedFont = fontType;
        this.selectedSize = fontSize;
        
        // Update font selection
        document.querySelectorAll('.font-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-font="${fontType}"]`).classList.add('selected');
        
        // Update size slider
        const sizeSlider = document.getElementById('sizeSlider');
        const sizeValue = document.getElementById('sizeValue');
        sizeSlider.value = fontSize;
        sizeValue.textContent = fontSize;
    }
}

// Text Area Controller
class TextAreaController {
    constructor(onInput, onClear, textArea) {
        this.onInput = onInput;
        this.onClear = onClear;
        this.textArea = textArea;
        this.lastSelection = { start: 0, end: 0 };
        this.setupTextAreaInput();
        this.setupClearButton();
        this.setupAutoFocus();
        this.setupViewportFix();
    }

    setupTextAreaInput() {
        let debounceTimer;
        
        const handleSelection = async (e) => {
            const target = e.target || this.textArea;
            const cursorPosition = target.selectionStart;
            const selectionStart = target.selectionStart;
            const selectionEnd = target.selectionEnd;
            
            // Improved mobile selection detection
            const hasSelection = selectionStart !== selectionEnd;
            const selectionChanged = 
                this.lastSelection.start !== selectionStart || 
                this.lastSelection.end !== selectionEnd;
            
            if (selectionChanged || e.type === 'input') {
                this.lastSelection = { start: selectionStart, end: selectionEnd };
                
                // Clear previous debounce for faster updates
                if (debounceTimer) clearTimeout(debounceTimer);
                
                // Immediate update for input events, slight delay for selection
                const delay = e.type === 'input' ? 0 : 25;
                
                debounceTimer = setTimeout(async () => {
                    await this.onInput(target.value, cursorPosition, selectionStart, selectionEnd);
                }, delay);
            }
        };

        // Optimized event listeners for mobile
        this.textArea.addEventListener('input', handleSelection);
        this.textArea.addEventListener('selectionchange', handleSelection);
        this.textArea.addEventListener('touchend', handleSelection);
        this.textArea.addEventListener('mouseup', handleSelection);
        this.textArea.addEventListener('keyup', handleSelection);
    }

    setupClearButton() {
        const clearButton = document.getElementById('clearButton');
        clearButton.addEventListener('click', async () => {
            this.textArea.value = '';
            await this.onClear();
            this.textArea.focus();
        });
    }

    setupAutoFocus() {
        setTimeout(() => this.textArea.focus(), 100);
        this.textArea.parentElement.addEventListener('click', () => this.textArea.focus());
    }

    setupViewportFix() {
        const updateVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        updateVH();
        window.addEventListener('resize', updateVH);
        window.addEventListener('orientationchange', updateVH);
    }
}

// Main Application
class ChatApp {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.uiController = new UIController();
        this.textAreaElement = document.getElementById('myMessages');
        this.preferencesController = new PreferencesController(this.firebaseService, this.uiController);
        this.textAreaController = new TextAreaController(
            this.handleInput.bind(this),
            this.handleClear.bind(this),
            this.textAreaElement
        );
        this.init();
    }

    async init() {
        // Load preferences first
        const preferences = await this.firebaseService.loadPreferences();
        this.uiController.updateFont(preferences.font);
        this.uiController.updateFontSize(preferences.fontSize);
        this.preferencesController.updateCurrentSelection(preferences.font, preferences.fontSize);

        // Load persisted text on startup
        const persistedText = await this.firebaseService.loadPersistedText();
        if (persistedText) {
            this.textAreaElement.value = persistedText;
            // Trigger update to sync cursor position
            await this.handleInput(persistedText, persistedText.length, persistedText.length, persistedText.length);
        }

        this.firebaseService.listenToMessages((snapshot) => {
            this.uiController.displayMessages(snapshot, this.firebaseService.userId);
        });

        this.firebaseService.listenToTyping((doc) => {
            this.uiController.displayTyping(doc);
        });

        // Listen to preference changes
        this.firebaseService.listenToPreferences((doc) => {
            if (doc.exists()) {
                const data = doc.data();
                this.uiController.updateFont(data.font);
                this.uiController.updateFontSize(data.fontSize);
                this.preferencesController.updateCurrentSelection(data.font, data.fontSize);
            }
        });

        window.addEventListener('beforeunload', () => {
            this.firebaseService.cleanup();
        });

        // Auto-save text periodically
        setInterval(() => {
            const currentText = this.textAreaElement.value;
            if (currentText) {
                this.firebaseService.updateTyping(
                    currentText, 
                    this.textAreaElement.selectionStart,
                    this.textAreaElement.selectionStart,
                    this.textAreaElement.selectionEnd
                );
            }
        }, 5000); // Save every 5 seconds
    }

    async handleInput(text, cursorPosition, selectionStart, selectionEnd) {
        await this.firebaseService.updateTyping(text, cursorPosition, selectionStart, selectionEnd);
    }

    async handleClear() {
        await this.firebaseService.updateTyping('', 0, 0, 0);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
}); 
