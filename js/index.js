// --- Localization Logic ---
window.translations = {};
window.currentLang = localStorage.getItem('hanzi_pref_lang') || 'en';

async function initLocalization() {
    try {
        const response = await fetch('translations.json');
        window.translations = await response.json();

        // If no saved preference, try IP detection
        if (!localStorage.getItem('hanzi_pref_lang')) {
            await detectLanguageByIP();
        }

        applyTranslations();
    } catch (e) {
        console.error('Failed to load translations:', e);
    }
}

async function detectLanguageByIP() {
    try {
        // Using a free IP API to get country code
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code; // e.g., 'VN', 'CN', 'KR', 'JP', 'RU', 'ES'

        const countryMap = {
            'VN': 'vi',
            'CN': 'zh',
            'KR': 'ko',
            'JP': 'ja',
            'RU': 'ru',
            'ES': 'es',
            'FR': 'fr'
        };

        if (countryMap[country]) {
            window.currentLang = countryMap[country];
            console.log(`Detected country ${country}, setting language to ${window.currentLang}`);
        } else {
            window.currentLang = 'en';
            console.log(`Detected country ${country}, defaulting to English`);
        }
    } catch (e) {
        console.warn('IP detection failed, defaulting to English');
        window.currentLang = 'en';
    }
}

function applyTranslations() {
    const langData = window.translations[window.currentLang] || window.translations['en'];

    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langData[key]) {
            el.innerText = langData[key];
        }
    });

    // Update active submit button if it exists
    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn && langData.submit_score) {
        submitBtn.innerText = langData.submit_score;
    }

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (langData[key]) {
            el.placeholder = langData[key];
        }
    });

    // Update cheering texts global
    cheeringTexts = langData.cheering || window.translations['en'].cheering;

    // Update active flag in UI
    document.querySelectorAll('.flag-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${window.currentLang}'`));
    });
}

function changeLanguage(lang) {
    window.currentLang = lang;
    localStorage.setItem('hanzi_pref_lang', lang);
    applyTranslations();

    // If in game, update current status if visible
    if (currentCharData) {
        updateGameStatus();
    }
}

function speakCurrentCharacter() {
    if (!currentCharData) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const text = currentCharData.character;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "zh-CN"; // Mandarin Chinese

    window.speechSynthesis.speak(speech);
}

function updateGameStatus() {
    if (!currentCharData) return;

    const langData = window.translations[window.currentLang] || window.translations['en'];

    let statusText = (langData.status_hsk || window.translations['en'].status_hsk)
        .replace('{word}', currentCharData.character)
        .replace('{pinyin}', currentCharData.pinyin)
        .replace('{english}', currentCharData.english);

    const statusEl = document.getElementById("status");
    statusEl.innerHTML = `<span>${statusText}</span>`;

    // Add speaker icon
    const speakerBtn = document.createElement("button");
    speakerBtn.className = "speaker-btn";
    speakerBtn.innerHTML = "🔊";
    speakerBtn.title = "Listen";
    speakerBtn.onclick = speakCurrentCharacter;
    statusEl.appendChild(speakerBtn);
}

window.changeLanguage = changeLanguage;

function togglePause() {
    if (hp <= 0) return; // Can't pause if dead

    window.isPaused = !window.isPaused;
    const pauseOverlay = document.getElementById("pause-overlay");
    const pauseBtn = document.getElementById("pause-btn");
    const langData = window.translations[window.currentLang] || window.translations['en'];

    if (window.isPaused) {
        pauseOverlay.classList.remove("hidden");
        pauseBtn.innerText = "▶️";
        if (writer) writer.pauseQuiz();
    } else {
        pauseOverlay.classList.add("hidden");
        pauseBtn.innerText = "⏸️";
        if (writer) writer.resumeQuiz();
    }
}

window.togglePause = togglePause;

// Call localization init
initLocalization();

let hp = 100;
let maxHP = 100;
window.score = 0;
let highScore = localStorage.getItem('hanzi_shooter_high_score') || 0;
let currentChar = "学";
let currentCharData = null;
let generatedPlayerName = "";
let writer;
let hpInterval;
window.isPaused = false;

// Chữ cổ vũ
let cheeringTexts = ['Nào chiến thôi!', 'Bạn làm được mà!', 'Go go go!', 'Hãy lên!', 'Cố lên!', 'Bạn làm được!', 'Xuất sắc!', 'Tuyệt vời!', 'Keep going!', 'Crush it!', 'Easy!', 'Bạn đẳng cấp!', 'Thần tốc!', 'Siêu nhân!'];

function getRandomCheeringText() {
    return cheeringTexts[Math.floor(Math.random() * cheeringTexts.length)];
}

//load dict
let dictionary = null;
let currentCharacters = [];
let currentCharIndex = 0;
async function loadDictionary() {
    try {
        const response = await fetch('hanzi-dictionary-full.json');
        //const response = await fetch('test=.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        if (!data.characters || !Array.isArray(data.characters)) {
            throw new Error('Invalid dictionary structure: missing or non-array characters field');
        }

        dictionary = data.characters;
        console.log(`✓ Dictionary loaded: ${dictionary.length} characters`);
        console.log(`  Sample: ${dictionary[0].character} (${dictionary[0].pinyin}) = ${dictionary[0].english}`);
    } catch (e) {
        console.error('✗ Dictionary load failed:', e.message);
        console.log('Using default mode');
    }
}

async function startGame() {
    document.getElementById("start-screen").classList.add("hidden");
    document.getElementById("game-over-screen").classList.add("hidden");
    document.getElementById("pause-btn").classList.remove("hidden");
    await loadDictionary();
    hp = 80;
    maxHP = 80;
    window.score = 0;
    updateHP();
    updateScoreHUD();
    await spawnMonster();
    startHPDrain();
}

function updateScoreHUD() {
    document.getElementById("score").innerText = window.score;
    document.getElementById("high-score").innerText = highScore;
}

function addScore(points) {
    window.score += points;
    if (window.score > highScore) {
        highScore = window.score;
        localStorage.setItem('hanzi_shooter_high_score', highScore);
    }
    updateScoreHUD();
}

async function validateWord(word) {
    const chars = word.split('');
    const validChars = [];

    for (let char of chars) {
        try {
            await HanziWriter.loadCharacterData(char);
            validChars.push(char);
        } catch (e) {
            console.warn(`⚠️ Character "${char}" not supported`);
        }
    }

    return validChars;
}

function injectGrid(containerId, size) {
    const container = document.getElementById(containerId);
    if (!container) return containerId;

    // Create the SVG grid
    const svgId = `${containerId}-grid-svg`;
    container.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" id="${svgId}" style="position: absolute;">
            <line x1="0" y1="0" x2="${size}" y2="${size}" stroke="#DDD" />
            <line x1="${size}" y1="0" x2="0" y2="${size}" stroke="#DDD" />
            <line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" stroke="#DDD" />
            <line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="#DDD" />
            <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="#DDD" stroke-width="2" />
        </svg>
    `;

    // Create a wrapper for HanziWriter content that sits on top of the grid
    const writerId = `${containerId}-writer-container`;
    const writerDiv = document.createElement('div');
    writerDiv.id = writerId;
    writerDiv.style.position = 'relative';
    writerDiv.style.width = `${size}px`;
    writerDiv.style.height = `${size}px`;
    container.appendChild(writerDiv);

    return writerId;
}

function createWriterForCurrentChar(canvasSize) {
    // Clear the writing area
    const container = document.getElementById("character-target-1");
    container.innerHTML = "";
    container.style.position = "relative";
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";

    const writerContainerId = injectGrid("character-target-1", canvasSize);
    const currentWriteChar = currentCharacters[currentCharIndex];

    writer = HanziWriter.create(writerContainerId, currentWriteChar, {
        width: canvasSize,
        height: canvasSize,
        showOutline: false,
        showCharacter: false,
        showHintAfterMisses: 3,
        highlightOnComplete: false,
        drawingWidth: 20
    });

    writer.quiz({
        onComplete: async function () {
            currentCharIndex++;

            if (currentCharIndex < currentCharacters.length) {
                // Move to next character - update status and preview
                updateGameStatus();

                // Update highlight in preview grid
                for (let i = 0; i < currentCharacters.length; i++) {
                    const previewDiv = document.getElementById(`char-preview-${i}`);
                    if (i === currentCharIndex) {
                        previewDiv.style.background = '#ffff99';
                        previewDiv.style.border = '3px solid #ffcc00';
                    } else if (i < currentCharIndex) {
                        previewDiv.style.background = '#ccffcc';
                        previewDiv.style.border = '2px solid #00cc00';
                    } else {
                        previewDiv.style.background = 'white';
                        previewDiv.style.border = '1px solid #ccc';
                    }
                }

                // Create writer for next character
                createWriterForCurrentChar(canvasSize);
            } else {
                // All characters completed - move to next word
                document.getElementById("status").innerText = `🔥 ${getRandomCheeringText()}`;
                addScore(currentCharacters.length);
                hp = 100;
                maxHP = 100;
                updateHP();
                await spawnMonster();
            }
        },
        onMistake: function () {
            reduceHP(5);
        }
    });
}

async function spawnMonster() {
    const defaultChars = [
        { character: "学", pinyin: "xué", english: "study" },
        { character: "战", pinyin: "zhàn", english: "fight" },
        { character: "心", pinyin: "xīn", english: "heart" },
        { character: "爱", pinyin: "ài", english: "love" },
        { character: "力", pinyin: "lì", english: "strength" },
        { character: "火", pinyin: "huǒ", english: "fire" }
    ];

    let pool = defaultChars;
    if (dictionary && dictionary.length > 0) {
        // Determine max HSK level based on score: 0-4: HSK1, 5-9: HSK2, etc.
        const maxHSKLevel = Math.min(6, Math.floor(window.score / 5) + 1);

        // Inclusive filtering: include all levels from 1 to maxHSKLevel
        pool = dictionary.filter(char => {
            if (!char.difficulty) return false;
            const level = parseInt(char.difficulty.replace("HSK", ""));
            return level <= maxHSKLevel;
        });

        if (pool.length === 0) pool = defaultChars;
    }

    let loaded = false;
    let retryCount = 0;
    const maxRetries = 10;

    while (!loaded && retryCount < maxRetries) {
        currentCharData = pool[Math.floor(Math.random() * pool.length)];
        currentChar = currentCharData.character;

        // Validate word by checking if all characters are supported
        const validChars = await validateWord(currentChar);

        if (validChars.length === currentChar.length && validChars.length > 0) {
            currentCharacters = validChars;
            currentCharIndex = 0;
            loaded = true;
        } else {
            console.warn(`⚠️ Word "${currentChar}" has unsupported characters. Skipping...`);
            retryCount++;
        }
    }

    if (!loaded) {
        currentCharData = defaultChars[0];
        currentChar = currentCharData.character;
        currentCharacters = [currentChar];
        currentCharIndex = 0;
    }

    updateGameStatus();

    // Set HP based on number of characters
    if (currentCharacters.length === 1) {
        hp = 90;
        maxHP = 90;
    } else if (currentCharacters.length === 2) {
        hp = 170;
        maxHP = 170;
    } else if (currentCharacters.length === 3) {
        hp = 260;
        maxHP = 260;
    }
    updateHP();
    speakCurrentCharacter();

    document.getElementById("character-target").innerHTML = "";
    document.getElementById("character-target-1").innerHTML = "";

    // Responsive canvas size based on viewport (width and height)
    let vw = window.innerWidth;
    let vh = window.innerHeight;

    // Calculate a fluid canvasSize based on viewport
    // For 3+ characters, we reduce the scale to make sure everything fits vertically
    let heightLimitMultiplier = currentCharacters.length >= 3 ? 0.28 : 0.35;
    let widthLimitMultiplier = 0.75;

    let canvasSize = Math.min(vw * widthLimitMultiplier, vh * heightLimitMultiplier);

    // Constrain canvasSize to reasonable limits
    if (vw > 768) {
        canvasSize = Math.min(canvasSize, 380);
    } else {
        // Minimum size depends on count: 3+ chars need smaller minimums to fit
        let minSize = currentCharacters.length >= 3 ? 150 : 180;
        canvasSize = Math.max(canvasSize, minSize);
    }

    // Setup character preview and reference
    if (currentCharacters.length === 1) {
        // Single character - show as reference
        const charContainer = document.getElementById("character-target");
        charContainer.style.display = "block";
        charContainer.style.width = canvasSize + "px";
        charContainer.style.height = canvasSize + "px";
        charContainer.style.margin = "15px auto";
        charContainer.style.background = "white";
        charContainer.style.borderRadius = "10px";
        charContainer.style.padding = "0";
        charContainer.style.overflow = "hidden";
        charContainer.style.position = "relative";
        charContainer.style.display = "flex";
        charContainer.style.justifyContent = "center";
        charContainer.style.alignItems = "center";

        const writerContainerId = injectGrid("character-target", canvasSize);
        HanziWriter.create(writerContainerId, currentChar, {
            width: canvasSize,
            height: canvasSize,
            showOutline: true,
            showCharacter: true,
            drawingWidth: 20
        });
    } else {
        // Multiple characters - show grid
        const gridContainer = document.getElementById("character-target");
        gridContainer.style.display = "flex";
        gridContainer.style.flexWrap = "wrap";
        gridContainer.style.justifyContent = "center";
        gridContainer.style.alignItems = "center";
        gridContainer.style.width = "100%";
        gridContainer.style.height = "auto";
        gridContainer.style.padding = "10px";
        gridContainer.style.gap = "10px";
        gridContainer.style.background = "transparent";
        gridContainer.style.borderRadius = "0";

        const smallCanvasSize = Math.floor(canvasSize * 0.45);
        currentCharacters.forEach((char, index) => {
            const charDiv = document.createElement('div');
            charDiv.id = `char-preview-${index}`;
            charDiv.style.width = smallCanvasSize + 'px';
            charDiv.style.height = smallCanvasSize + 'px';
            charDiv.style.background = index === currentCharIndex ? '#ffff99' : 'white';
            charDiv.style.borderRadius = '5px';
            charDiv.style.border = index === currentCharIndex ? '3px solid #ffcc00' : '1px solid #ccc';
            charDiv.style.position = "relative";
            charDiv.style.display = "flex";
            charDiv.style.justifyContent = "center";
            charDiv.style.alignItems = "center";
            charDiv.style.overflow = "hidden";
            gridContainer.appendChild(charDiv);

            const writerContainerId = injectGrid(charDiv.id, smallCanvasSize);
            HanziWriter.create(writerContainerId, char, {
                width: smallCanvasSize,
                height: smallCanvasSize,
                showOutline: true,
                showCharacter: true,
                drawingWidth: 8
            });
        });
    }

    // Create writer for first character (works for both single and multiple)
    createWriterForCurrentChar(canvasSize);
}

function startHPDrain() {
    clearInterval(hpInterval);
    hpInterval = setInterval(() => {
        if (!window.isPaused) {
            reduceHP(1);
        }
    }, 300);
}

function reduceHP(amount) {
    hp -= amount;
    if (hp <= 0) {
        hp = 0;
        gameOver();
    }
    updateHP();
}

function updateHP() {
    const hpPercent = (hp / maxHP) * 100;
    document.getElementById("hp-bar").style.width = hpPercent + "%";
    document.getElementById("hp-text").innerText = Math.ceil(hpPercent) + "%";
}

function generateBeautifulName() {
    const adjectives = ["Golden", "Emerald", "Mystic", "Azure", "Silent", "Dancing", "Crouching", "Flying", "Crimson", "Radiant", "Zen", "Jade", "Silver", "Imperial", "Wild", "Ocean", "Spirit", "Eternal"];
    const nouns = ["Dragon", "Phoenix", "Panda", "Lotus", "Ink", "Brush", "Mountain", "River", "Storm", "Tiger", "Crane", "Soul", "Warrior", "Shadow", "Cloud", "Bamboo", "Blade", "Moon"];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const suffix = Math.random().toString(16).substring(2, 6).toUpperCase();

    return `${adj}_${noun}_${suffix}`;
}

function refreshName() {
    document.getElementById("player-name").value = generateBeautifulName();
}

function gameOver() {
    clearInterval(hpInterval);
    document.getElementById("pause-btn").classList.add("hidden");
    document.getElementById("pause-overlay").classList.add("hidden");
    window.isPaused = false;

    const langData = window.translations[window.currentLang] || window.translations['en'];
    document.getElementById("status").innerText = `💀 ${langData.game_over || 'Game Over!'}`;

    // Suggest a beautiful name
    refreshName();

    // Show game over overlay
    const overlay = document.getElementById("game-over-screen");
    overlay.classList.remove("hidden");
    overlay.querySelector("#final-score-display span").innerText = window.score;
}

window.startGame = startGame;
window.refreshName = refreshName;
