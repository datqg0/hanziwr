let hp = 100;
let maxHP = 100;
window.score = 0;
let highScore = localStorage.getItem('hanzi_shooter_high_score') || 0;
let currentChar = "学";
let currentCharData = null;
let generatedPlayerName = "";
let writer;
let hpInterval;

// Chữ cổ vũ
const cheeringTexts = ['Nào chiến thôi!', 'Bạn làm được mà!', 'Go go go!', 'Hãy lên!', 'Cố lên!', 'Bạn làm được!', 'Xuất sắc!', 'Tuyệt vời!', 'Keep going!', 'Crush it!', 'Easy!', 'Bạn đẳng cấp!', 'Thần tốc!', 'Siêu nhân!'];

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

function createWriterForCurrentChar(canvasSize) {
    // Clear the writing area
    document.getElementById("character-target-1").innerHTML = "";

    const currentWriteChar = currentCharacters[currentCharIndex];
    writer = HanziWriter.create('character-target-1', currentWriteChar, {
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
                document.getElementById("status").innerText = `📖 Chữ ${currentCharIndex + 1}/${currentCharacters.length}`;

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

    document.getElementById("status").innerText = `📖 ${currentCharData.pinyin} (${currentCharData.english})`;

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

        HanziWriter.create('character-target', currentChar, {
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
            charDiv.style.padding = '5px';
            charDiv.style.borderRadius = '5px';
            charDiv.style.border = index === currentCharIndex ? '3px solid #ffcc00' : '1px solid #ccc';
            gridContainer.appendChild(charDiv);

            HanziWriter.create(`char-preview-${index}`, char, {
                width: smallCanvasSize - 10,
                height: smallCanvasSize - 10,
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
        reduceHP(1);
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
    document.getElementById("status").innerText = "💀 Game Over!";

    // Suggest a beautiful name
    refreshName();

    // Show game over overlay
    const overlay = document.getElementById("game-over-screen");
    overlay.classList.remove("hidden");
    overlay.querySelector("#final-score-display span").innerText = window.score;
}

window.startGame = startGame;
window.refreshName = refreshName;
