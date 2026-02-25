import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDDi_bKIWk2J4JlV7Hr5FPvGG5uMLX7qZc",
    authDomain: "chinese-writer-14f9a.firebaseapp.com",
    projectId: "chinese-writer-14f9a",
    storageBucket: "chinese-writer-14f9a.firebasestorage.app",
    messagingSenderId: "172568786390",
    appId: "1:172568786390:web:d388025c7289b71bff2077",
    measurementId: "G-67QE12KPHW"
};

// --- Localization Logic for Rank Page ---
let translations = {};
let currentLang = localStorage.getItem('hanzi_pref_lang') || 'en';

async function initLocalization() {
    try {
        const response = await fetch('translations.json');
        translations = await response.json();
        applyTranslations();
    } catch (e) {
        console.error('Failed to load translations:', e);
    }
}

function applyTranslations() {
    const langData = translations[currentLang] || translations['en'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langData[key]) {
            el.innerText = langData[key];
        }
    });
}

initLocalization();

// Initialize Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    loadLeaderboard();
} catch (e) {
    console.error("Firebase initialization failed", e);
    const loadingElem = document.getElementById("loading");
    if (loadingElem) loadingElem.innerText = "Error: Check your Firebase Config";
}

async function loadLeaderboard() {
    try {
        const scoresRef = collection(db, "scores");
        const q = query(scoresRef, orderBy("score", "desc"), limit(10));
        const querySnapshot = await getDocs(q);

        const tableBody = document.getElementById("leaderboard-body");
        if (!tableBody) return;
        tableBody.innerHTML = "";

        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement("tr");

            let rankClass = "";
            if (rank === 1) rankClass = "rank-1";
            else if (rank === 2) rankClass = "rank-2";
            else if (rank === 3) rankClass = "rank-3";

            row.innerHTML = `
                <td class="${rankClass}">#${rank}</td>
                <td>${data.name || "Anonymous"}</td>
                <td class="score-val">${data.score}</td>
            `;
            tableBody.appendChild(row);
            rank++;
        });

        const loadingElem = document.getElementById("loading");
        const rankTable = document.getElementById("rank-table");
        if (loadingElem) loadingElem.style.display = "none";
        if (rankTable) rankTable.classList.remove("hidden");
    } catch (error) {
        console.error("Error fetching leaderboard: ", error);
        const loadingElem = document.getElementById("loading");
        const langData = translations[currentLang] || translations['en'];
        if (loadingElem) loadingElem.innerText = langData.error || "Failed to load scores.";
    }
}
