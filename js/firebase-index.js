import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Initialize Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase initialization failed", e);
}

// Basic Anti-Cheat: Verification Token
function generateToken(s, n) {
    return btoa(s + "_" + n + "_" + "H4nzi_S4lt");
}

async function submitScore() {
    console.log("Submit Score triggered");
    const name = document.getElementById("player-name").value.trim() || "Anonymous";
    const submitBtn = document.getElementById("submit-btn");
    const currentScore = parseInt(window.score || 0);
    const langData = window.translations[window.currentLang] || window.translations['en'];

    console.log(`Submitting score: ${currentScore} for player: ${name}`);

    if (!firebaseConfig.apiKey.startsWith("YOUR")) {
        if (!db) {
            console.error("Firebase DB not initialized");
            alert(langData.firebase_init_error || "Firebase not initialized correctly.");
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = langData.submitting || "Submitting...";

            await addDoc(collection(db, "scores"), {
                name: name,
                score: currentScore,
                timestamp: serverTimestamp(),
                token: generateToken(currentScore, name)
            });

            console.log("Score submitted successfully");
            alert(langData.score_submitted || "Score submitted successfully!");
            location.reload();
        } catch (error) {
            console.error("Error adding document: ", error);
            alert(langData.submit_error || "Error submitting score. Please try again.");
            submitBtn.disabled = false;
            submitBtn.innerText = langData.submit_score || "Submit Score";
        }
    } else {
        console.warn("Firebase not configured");
        alert(langData.firebase_config_error || "Firebase not configured. Score was not saved to online leaderboard.");
        location.reload();
    }
}

document.getElementById("submit-btn").addEventListener("click", submitScore);
