// Real-time Chat App - Localized Font System
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
        this.debounceDelay = 50;
    }

    listenToMessages(callback) {
        const messagesQuery = query(collection(this.db, 'messages'), orderBy('timestamp'));
        return onSnapshot(messagesQuery, callback);
    }

    listenToTyping(callback) {
        return onSnapshot(doc(this.db, 'typing', this.otherUserId), callback);
    }

    listenToUserPreferences(callback) {
        return onSnapshot(doc(this.db, 'user_preferences', this.otherUserId), callback);
    }

    async updateTyping(text, cursorPosition, selectionStart, selectionEnd) {
        const now = Date.now();
        
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

    async updateUserPreferences(font, fontSize) {
        try {
            await setDoc(doc(this.db, 'user_preferences', this.userId), {
                font: font,
                fontSize: fontSize,
                timestamp: Date.now()
            }, { merge: true });
        } catch (error) {
            console.log('Preferences update error:', error);
        }
    }

    async loadUserPreferences() {
        try {
            const prefsDoc = await getDoc(doc(this.db, 'user_preferences', this.userId));
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
        this.myTextArea = document.getElementById('myMessages');
        this.myFont = 'monospace';
        this.myFontSize = 20;
        this.otherFont = 'monospace';
        this.otherFontSize = 20;
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

    updateMyTextArea(font, fontSize) {
        this.myFont = font;
        this.myFontSize = fontSize;
        const fontFamily = FONTS[font] || FONTS.monospace;
        
        this.myTextArea.style.fontFamily = fontFamily;
        this.myTextArea.style.fontSize = fontSize + 'px';
        
        // Update direction for RTL/LTR
        if (font === 'noto') {
            this.myTextArea.classList.add('text-area--rtl');
            this.myTextArea.classList.remove('text-area--ltr');
        } else {
            this.myTextArea.classList.add('text-area--ltr');
            this.myTextArea.classList.remove('text-area--rtl');
        }
    }

    updateOtherDisplay(font, fontSize) {
        this.otherFont = font;
        this.otherFontSize = fontSize;
        const fontFamily = FONTS[font] || FONTS.monospace;
        
        this.otherMessagesDisplay.style.fontFamily = fontFamily;
        this.otherMessagesDisplay.style.fontSize = fontSize + 'px';
        
        // Update direction for RTL/LTR
        if (font === 'noto') {
            this.otherMessagesDisplay.classList.add('text-with-cursor--rtl');
            this.otherMessagesDisplay.classList.remove('text-with-cursor--ltr');
        } else {
            this.otherMessagesDisplay.classList.add('text-with-cursor--ltr');
            this.otherMessagesDisplay.classList.remove('text-with-cursor--rtl');
        }
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

// Control Panel Controller
class ControlPanelController {
    constructor(firebaseService, uiController) {
        this.firebaseService = firebaseService;
        this.uiController = uiController;
        this.currentFont = 'monospace';
        this.currentSize = 20;
        this.menuOpen = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Clear button
        document.getElementById('clearButton').addEventListener('click', async () => {
            this.uiController.myTextArea.value = '';
            await this.firebaseService.updateTyping('', 0, 0, 0);
            this.uiController.myTextArea.focus();
        });

        // Hamburger menu
        document.getElementById('hamburgerButton').addEventListener('click', () => {
            this.toggleMenu();
        });

        // Font toggle
        document.getElementById('fontToggle').addEventListener('click', () => {
            this.toggleFont();
        });

        // Size controls
        document.getElementById('sizePlus').addEventListener('click', () => {
            this.changeSize(2);
        });

        document.getElementById('sizeMinus').addEventListener('click', () => {
            this.changeSize(-2);
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.control-panel') && this.menuOpen) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        const toggleOptions = document.getElementById('toggleOptions');
        this.menuOpen = !this.menuOpen;
        
        if (this.menuOpen) {
            toggleOptions.classList.add('active');
        } else {
            toggleOptions.classList.remove('active');
        }
    }

    closeMenu() {
        const toggleOptions = document.getElementById('toggleOptions');
        toggleOptions.classList.remove('active');
        this.menuOpen = false;
    }

    async toggleFont() {
        this.currentFont = this.currentFont === 'monospace' ? 'noto' : 'monospace';
        await this.updatePreferences();
        this.closeMenu();
    }

    async changeSize(delta) {
        this.currentSize = Math.max(14, Math.min(32, this.currentSize + delta));
        await this.updatePreferences();
    }

    async updatePreferences() {
        this.uiController.updateMyTextArea(this.currentFont, this.currentSize);
        await this.firebaseService.updateUserPreferences(this.currentFont, this.currentSize);
    }

    setCurrentPreferences(font, fontSize) {
        this.currentFont = font;
        this.currentSize = fontSize;
        this.uiController.updateMyTextArea(font, fontSize);
    }
}

// Text Area Controller
class TextAreaController {
    constructor(onInput, textArea) {
        this.onInput = onInput;
        this.textArea = textArea;
        this.lastSelection = { start: 0, end: 0 };
        this.setupTextAreaInput();
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
            
            const selectionChanged = 
                this.lastSelection.start !== selectionStart || 
                this.lastSelection.end !== selectionEnd;
            
            if (selectionChanged || e.type === 'input') {
                this.lastSelection = { start: selectionStart, end: selectionEnd };
                
                if (debounceTimer) clearTimeout(debounceTimer);
                
                const delay = e.type === 'input' ? 0 : 25;
                
                debounceTimer = setTimeout(async () => {
                    await this.onInput(target.value, cursorPosition, selectionStart, selectionEnd);
                }, delay);
            }
        };

        this.textArea.addEventListener('input', handleSelection);
        this.textArea.addEventListener('selectionchange', handleSelection);
        this.textArea.addEventListener('touchend', handleSelection);
        this.textArea.addEventListener('mouseup', handleSelection);
        this.textArea.addEventListener('keyup', handleSelection);
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
        this.controlPanelController = new ControlPanelController(this.firebaseService, this.uiController);
        this.textAreaController = new TextAreaController(
            this.handleInput.bind(this),
            this.uiController.myTextArea
        );
        this.init();
    }

    async init() {
        // Load my preferences
        const myPreferences = await this.firebaseService.loadUserPreferences();
        this.controlPanelController.setCurrentPreferences(myPreferences.font, myPreferences.fontSize);

        // Load persisted text
        const persistedText = await this.firebaseService.loadPersistedText();
        if (persistedText) {
            this.uiController.myTextArea.value = persistedText;
            await this.handleInput(persistedText, persistedText.length, persistedText.length, persistedText.length);
        }

        // Listen to messages
        this.firebaseService.listenToMessages((snapshot) => {
            this.uiController.displayMessages(snapshot, this.firebaseService.userId);
        });

        // Listen to other person's typing
        this.firebaseService.listenToTyping((doc) => {
            this.uiController.displayTyping(doc);
        });

        // Listen to other person's preferences (for their display area)
        this.firebaseService.listenToUserPreferences((doc) => {
            if (doc.exists()) {
                const data = doc.data();
                this.uiController.updateOtherDisplay(data.font, data.fontSize);
            }
        });

        window.addEventListener('beforeunload', () => {
            this.firebaseService.cleanup();
        });

        // Auto-save text periodically
        setInterval(() => {
            const currentText = this.uiController.myTextArea.value;
            if (currentText) {
                this.firebaseService.updateTyping(
                    currentText, 
                    this.uiController.myTextArea.selectionStart,
                    this.uiController.myTextArea.selectionStart,
                    this.uiController.myTextArea.selectionEnd
                );
            }
        }, 5000);
    }

    async handleInput(text, cursorPosition, selectionStart, selectionEnd) {
        await this.firebaseService.updateTyping(text, cursorPosition, selectionStart, selectionEnd);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
}); 
