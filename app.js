// Real-time Chat App - Optimized for Production
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, onSnapshot, query, orderBy, doc, setDoc, deleteDoc, collection } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

// Firebase Service
class FirebaseService {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.userId = window.CHAT_USER_ID || 'user1';
        this.otherUserId = window.CHAT_OTHER_USER_ID || 'user2';
    }

    listenToMessages(callback) {
        const messagesQuery = query(collection(this.db, 'messages'), orderBy('timestamp'));
        return onSnapshot(messagesQuery, callback);
    }

    listenToTyping(callback) {
        return onSnapshot(doc(this.db, 'typing', this.otherUserId), callback);
    }

    async updateTyping(text, cursorPosition, selectionStart, selectionEnd) {
        if (text.length > 0) {
            await setDoc(doc(this.db, 'typing', this.userId), {
                isTyping: true,
                text: text,
                cursorPosition: cursorPosition || text.length,
                selectionStart: selectionStart || cursorPosition || text.length,
                selectionEnd: selectionEnd || cursorPosition || text.length,
                timestamp: Date.now()
            });
        } else {
            await deleteDoc(doc(this.db, 'typing', this.userId));
        }
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.otherMessagesDisplay.scrollTop = this.otherMessagesDisplay.scrollHeight;
    }
}

// Text Area Controller
class TextAreaController {
    constructor(onInput, onClear, textArea) {
        this.onInput = onInput;
        this.onClear = onClear;
        this.textArea = textArea;
        this.setupTextAreaInput();
        this.setupClearButton();
        this.setupAutoFocus();
        this.setupViewportFix();
    }

    setupTextAreaInput() {
        const handleSelection = async (e) => {
            const target = e.target || this.textArea;
            const cursorPosition = target.selectionStart;
            const selectionStart = target.selectionStart;
            const selectionEnd = target.selectionEnd;
            await this.onInput(target.value, cursorPosition, selectionStart, selectionEnd);
        };

        this.textArea.addEventListener('input', handleSelection);
        this.textArea.addEventListener('selectionchange', handleSelection);
        this.textArea.addEventListener('select', handleSelection);
        this.textArea.addEventListener('click', handleSelection);
        this.textArea.addEventListener('keyup', handleSelection);
        this.textArea.addEventListener('mouseup', handleSelection);
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
        this.textAreaController = new TextAreaController(
            this.handleInput.bind(this),
            this.handleClear.bind(this),
            document.getElementById('myMessages')
        );
        this.init();
    }

    async init() {
        this.firebaseService.listenToMessages((snapshot) => {
            this.uiController.displayMessages(snapshot, this.firebaseService.userId);
        });

        this.firebaseService.listenToTyping((doc) => {
            this.uiController.displayTyping(doc);
        });

        window.addEventListener('beforeunload', () => {
            this.firebaseService.cleanup();
        });
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