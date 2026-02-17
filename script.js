// 麻將決策助手核心邏輯

// --- 配置 ---
const TILES = {
    man: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    pin: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    sou: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    honors: ['東', '南', '西', '北', '中', '發', '白']
};

const TILE_MAP = {
    '1m': '一萬', '2m': '二萬', '3m': '三萬', '4m': '四萬', '5m': '五萬', '6m': '六萬', '7m': '七萬', '8m': '八萬', '9m': '九萬',
    '1p': '一筒', '2p': '二筒', '3p': '三筒', '4p': '四筒', '5p': '五筒', '6p': '六筒', '7p': '七筒', '8p': '八筒', '9p': '九筒',
    '1s': '一索', '2s': '二索', '3s': '三索', '4s': '四索', '5s': '五索', '6s': '六索', '7s': '七索', '8s': '八索', '9s': '九索',
    '東': '東', '南': '南', '西': '西', '北': '北', '中': '中', '發': '發', '白': '白'
};

const COLORS = {
    'm': '#d32f2f', // 萬
    'p': '#1976d2', // 筒
    's': '#388e3c', // 索
    'z': '#333'     // 字
};

// 狀態
let gameState = {
    rule: 16, // 16 or 13
    wallCount: 144, // 剩餘牌牆
    myHand: [], // 自己的手牌 (array of tile strings)
    drawnTile: null, // 剛摸到的牌
    rivers: [[], [], [], []], // 0:自己, 1:下家, 2:對家, 3:上家
    melds: [[], [], [], []],
    tileCounts: {}, // 全局計數器
    mode: 'hand', // 'record' or 'hand'
    selectedPlayer: 3 // 預設選中上家
};

// 歷史記錄 (Undo)
let historyStack = [];

// --- DOM 元素 ---
const dom = {
    wallCount: document.getElementById('wallCount'),
    rivers: [
        document.getElementById('river-0'),
        document.getElementById('river-1'),
        document.getElementById('river-2'),
        document.getElementById('river-3')
    ],
    myHand: document.getElementById('myHand'),
    drawnTile: document.getElementById('drawnTile'),
    defensePanel: document.getElementById('defense-recommendation'),
    offensePanel: document.getElementById('offense-recommendation'),
    modeTabs: document.querySelectorAll('.tab-btn'),
    keyboards: {
        man: document.getElementById('row-man'),
        pin: document.getElementById('row-pin'),
        sou: document.getElementById('row-sou'),
        honors: document.getElementById('row-honors')
    },
    opponents: [
        null, // 0:我 (無此元素)
        document.getElementById('player-1'), // 下家
        document.getElementById('player-2'), // 對家
        document.getElementById('player-3')  // 上家
    ],
    actionGroups: {
        record: document.getElementById('record-actions'),
        hand: document.getElementById('hand-actions')
    },
    drawBtn: document.getElementById('drawBtn'),
    sortBtn: document.getElementById('sortBtn'),
    resetBtn: document.getElementById('resetBtn'),
    undoBtn: document.getElementById('undoBtn')
};

// --- 初始化 ---
function init() {
    initKeyboard();
    resetGame();
    attachEvents();
    render();
}

function initKeyboard() {
    createKeyboardRow(dom.keyboards.man, TILES.man, 'm');
    createKeyboardRow(dom.keyboards.pin, TILES.pin, 'p');
    createKeyboardRow(dom.keyboards.sou, TILES.sou, 's');
    createKeyboardRow(dom.keyboards.honors, TILES.honors, 'z');
}

function createKeyboardRow(container, items, suffix) {
    container.innerHTML = '';

    // 添加花色標籤
    const label = document.createElement('div');
    label.className = 'suit-label';
    label.style.color = COLORS[suffix];
    label.textContent = suffix === 'm' ? '萬' : suffix === 'p' ? '筒' : suffix === 's' ? '索' : '字';
    container.appendChild(label);

    items.forEach(item => {
        const btn = document.createElement('div');
        btn.className = 'tile-btn';

        let display = item;
        let value = (typeof item === 'number') ? item + suffix : item;

        btn.innerHTML = `<span style="color:${COLORS[suffix]}">${display}</span>`;
        btn.dataset.tile = value;

        btn.addEventListener('click', () => handleTileInput(value));
        container.appendChild(btn);
    });
}

function resetGame() {
    gameState.wallCount = gameState.rule === 16 ? 144 : 136;
    gameState.myHand = [];
    gameState.drawnTile = null;
    gameState.rivers = [[], [], [], []];
    gameState.melds = [[], [], [], []];
    gameState.tileCounts = {};
    historyStack = []; // 清空歷史

    // 初始化計數
    const suits = ['m', 'p', 's'];
    suits.forEach(s => {
        for (let i = 1; i <= 9; i++) gameState.tileCounts[i + s] = 0;
    });
    TILES.honors.forEach(h => gameState.tileCounts[h] = 0);

    toggleMode('hand');
    render();
}

// --- 歷史操作 (Undo) ---
function pushHistory() {
    // 深拷貝當前狀態
    const snapshot = JSON.parse(JSON.stringify(gameState));
    // 不需要拷貝 DOM 相關的，只需數據
    historyStack.push(snapshot);
    if (historyStack.length > 20) historyStack.shift(); // 限制20步
    updateUndoBtn();
}

function undo() {
    if (historyStack.length === 0) return;
    const previous = historyStack.pop();
    // 恢復狀態
    gameState = previous;
    updateUndoBtn();
    analyze();
    render();

    // 恢復 UI 相關狀態 (selectedPlayer, mode)
    toggleMode(gameState.mode);
    updatePlayerSelect();
}

function updateUndoBtn() {
    dom.undoBtn.disabled = historyStack.length === 0;
    dom.undoBtn.style.opacity = historyStack.length === 0 ? 0.5 : 1;
}

// --- 核心邏輯 ---

function handleTileInput(tile) {
    pushHistory(); // 操作前記錄

    if (gameState.mode === 'record') {
        const player = gameState.selectedPlayer;
        recordDiscard(player, tile);
    } else if (gameState.mode === 'hand') {
        addTileToHand(tile);
    }
    analyze();
    render();
}

function recordDiscard(playerIdx, tile) {
    gameState.rivers[playerIdx].push(tile);
    incrementTileCount(tile);
    gameState.wallCount--;

    // 如果是上家打牌，提示可能輪到我摸牌
    if (playerIdx === 3) {
        showActionHint('輪到您了？請摸牌或吃碰');
    }
}

function discardTile(tile) {
    pushHistory(); // 操作前記錄

    // 從手牌移除（優先移除手牌裡的，還是摸到的那個？）
    // 邏輯：如果是摸到的牌且沒上手，優先打那張？
    // 為了簡單：直接找 index

    let handIdx = gameState.myHand.indexOf(tile);
    let removed = false;

    if (gameState.drawnTile === tile) {
        gameState.drawnTile = null;
        removed = true;
    } else if (handIdx > -1) {
        gameState.myHand.splice(handIdx, 1);
        removed = true;

        // 把摸到的牌補進手牌
        if (gameState.drawnTile) {
            gameState.myHand.push(gameState.drawnTile);
            gameState.drawnTile = null;
            sortHand();
        }
    }

    if (removed) {
        gameState.rivers[0].push(tile);
        incrementTileCount(tile);
        analyze();
        render();
    }
}

function addTileToHand(tile) {
    const limit = gameState.rule === 16 ? 16 : 13;

    if (gameState.drawnTile) {
        alert('手牌已滿 (+1摸牌)，請先打出一張牌！');
        // 是否應該幫他回滾這次操作？不需要，因為 pushHistory 是在前一步
        historyStack.pop(); // 恢復堆疊，因為這次操作無效
        return;
    }

    if (gameState.myHand.length < limit) {
        gameState.myHand.push(tile);
        sortHand();
        showActionHint(`手牌 ${gameState.myHand.length}/${limit}`);
    } else {
        // 手牌滿，算摸牌
        gameState.drawnTile = tile;
        gameState.wallCount--;
        showActionHint('摸牌成功！請選擇一張手牌打出');
    }
}

// 模擬摸牌（不知道是什麼牌，只是佔位？不，決策助手必須知道是什麼牌才能建議）
// 所以「我摸牌」按鈕實際上是切換到「輸入摸牌模式」
function drawTile() {
    toggleMode('hand');
    showActionHint('請點選鍵盤，輸入您摸到的牌');
}

function incrementTileCount(tile) {
    if (gameState.tileCounts[tile] === undefined) gameState.tileCounts[tile] = 0;
    gameState.tileCounts[tile]++;
}

function getRemainingCount(tile) {
    let consumed = 0;
    gameState.rivers.forEach(r => r.forEach(t => { if (t === tile) consumed++; }));
    gameState.myHand.forEach(t => { if (t === tile) consumed++; });
    if (gameState.drawnTile === tile) consumed++;
    return 4 - consumed;
}

// --- 分析 ---
function analyze() {
    analyzeDefense();
    analyzeOffense();
}

function analyzeDefense() {
    let safeTiles = new Set();
    [1, 2, 3].forEach(pIdx => {
        gameState.rivers[pIdx].forEach(t => safeTiles.add(t));
    });

    if (safeTiles.size === 0) {
        dom.defensePanel.innerHTML = '<div class="placeholder-text">場上尚無安全牌</div>';
        return;
    }

    let html = '';
    const sortedSafe = Array.from(safeTiles).sort();

    sortedSafe.slice(0, 8).forEach(tile => {
        const remain = getRemainingCount(tile);
        html += `<div class="recommendation-item">
            <span class="rec-rank" style="color:#4caf50">${TILE_MAP[tile] || tile}</span>
            <span class="rec-prob">現物 (剩 ${remain} 張)</span>
        </div>`;
    });
    dom.defensePanel.innerHTML = html;
}

function analyzeOffense() {
    const hand = [...gameState.myHand];
    if (gameState.drawnTile) hand.push(gameState.drawnTile);

    if (hand.length < 5) {
        dom.offensePanel.innerHTML = '<div class="placeholder-text">請建立手牌</div>';
        return;
    }

    const scores = hand.map(tile => {
        return { tile, score: evaluateTile(tile, hand) };
    });

    scores.sort((a, b) => a.score - b.score);

    let html = '';
    const seen = new Set();
    let count = 0;

    scores.forEach(({ tile, score }) => {
        if (seen.has(tile) || count >= 3) return;
        seen.add(tile);
        count++;

        const isSafe = isTileSafe(tile);
        const safetyText = isSafe ? '安全' : '危險(生)';
        const color = isSafe ? '#4caf50' : '#f44336';

        html += `<div class="recommendation-item">
            <span class="rec-rank" style="color:${color}">${TILE_MAP[tile] || tile}</span>
            <span class="rec-prob">${safetyText} / 評分:${score}</span>
        </div>`;
    });

    dom.offensePanel.innerHTML = html;
}

function evaluateTile(tile, hand) {
    // 1. 字牌處理
    if (['東', '南', '西', '北', '中', '發', '白'].includes(tile)) {
        const count = hand.filter(t => t === tile).length;
        if (count >= 3) return 200; // 刻子，絕對不打
        if (count === 2) return 80; // 對子，保留
        return 0; // 孤張字牌，優先打
    }

    const suit = tile.substr(-1);
    const num = parseInt(tile);
    let score = 5; // 基礎分

    // 檢查是否有對子/刻子關係
    const pairCount = hand.filter(t => t === tile).length;
    if (pairCount >= 3) score += 200; // 刻子
    else if (pairCount === 2) score += 80; // 對子 (提高權重)

    let hasSideWait = false; // 是否有兩面搭 (23, 78)
    let hasMiddleWait = false; // 是否有坎張/邊張 (46, 12, 89)

    // 遍歷手牌找鄰居
    hand.forEach(other => {
        if (other === tile) return; // 跳過自己
        if (other.substr(-1) !== suit) return; // 不同花色跳過

        const otherNum = parseInt(other);
        const diff = Math.abs(num - otherNum);

        if (diff === 1) {
            // 兩面搭 (23) -> 非常好
            // 但如果是邊張 (12, 89) 則稍差
            if ((num === 1 && otherNum === 2) || (num === 2 && otherNum === 1) ||
                (num === 8 && otherNum === 9) || (num === 9 && otherNum === 8)) {
                score += 30; // 邊張搭
                hasMiddleWait = true;
            } else {
                score += 50; // 兩面搭
                hasSideWait = true;
            }
        } else if (diff === 2) {
            // 坎張 (46) -> 普通
            score += 25;
            hasMiddleWait = true;
        }
    });

    // 3. 額外加分與扣分
    // 如果是中張牌 (3-7)，本身價值較高 (因為容易靠張)
    if (num >= 3 && num <= 7) score += 5;

    // 如果這張牌既沒有對子，也沒有搭子，那就是徹底的孤張
    if (!hasSideWait && !hasMiddleWait && pairCount === 1) {
        if (num === 1 || num === 9) score -= 5; // 麼九孤張最差
        if (num === 2 || num === 8) score -= 2; // 二八孤張次差
    }

    return score;
}

function isTileSafe(tile) {
    for (let i = 1; i <= 3; i++) {
        if (gameState.rivers[i].includes(tile)) return true;
    }
    return false;
}

// --- 渲染 ---
// 點擊河裡的牌刪除（如果點錯，但不想用 Undo）
window.onRiverTileClick = function (playerIdx, tileIdx) {
    if (confirm('移除這張牌？')) {
        pushHistory(); // 移除前記錄
        const tile = gameState.rivers[playerIdx][tileIdx];
        gameState.rivers[playerIdx].splice(tileIdx, 1);
        gameState.tileCounts[tile]--; // 計數減少
        gameState.wallCount++; // 牌牆增加（假設是誤打）
        render();
        analyze();
    }
};

function render() {
    dom.wallCount.textContent = gameState.wallCount;

    gameState.rivers.forEach((river, idx) => {
        dom.rivers[idx].innerHTML = river.map((t, i) => createTileHTML(t, 'small', false, idx, i)).join('');
    });

    dom.myHand.innerHTML = gameState.myHand.map(t => createTileHTML(t, 'normal', true)).join('');

    if (gameState.drawnTile) {
        dom.drawnTile.innerHTML = createTileHTML(gameState.drawnTile, 'normal', true);
        dom.drawnTile.classList.remove('hidden');
    } else {
        dom.drawnTile.innerHTML = '';
        dom.drawnTile.classList.add('hidden');
    }

    updatePlayerSelect();
    updateUndoBtn();
}

function updatePlayerSelect() {
    for (let i = 1; i <= 3; i++) {
        const el = dom.opponents[i];
        if (el) {
            if (i === gameState.selectedPlayer && gameState.mode === 'record') el.classList.add('selected');
            else el.classList.remove('selected');
        }
    }
}

function createTileHTML(tile, size = 'normal', interactable = false, playerIdx = null, tileIdx = null) {
    let display = TILE_MAP[tile] || tile;
    // 不再對 small 還有特殊簡寫，直接用大字 (因為 CSS 已經放大了)

    let color = '#333';
    if (tile.includes('m')) color = '#d32f2f';
    if (tile.includes('p')) color = '#1976d2';
    if (tile.includes('s')) color = '#388e3c';
    if (tile === '中' || tile === '發') color = '#d32f2f';

    let clickAttr = '';
    if (interactable) {
        clickAttr = `onclick="window.onHandTileIdxClick('${tile}')"`;
    } else if (playerIdx !== null && tileIdx !== null) {
        // 河裡的牌可以點擊刪除
        clickAttr = `onclick="window.onRiverTileClick(${playerIdx}, ${tileIdx})"`;
    }

    return `<div class="${size === 'small' ? 'small-tile' : 'my-tile'}" 
                 style="color: ${color}" 
                 ${clickAttr}>
                ${display}
            </div>`;
}

window.onHandTileIdxClick = function (tile) {
    // 直接打出，不再確認 (因為有 Undo)
    discardTile(tile);
};

function sortHand() {
    const suitOrder = { 'm': 0, 'p': 1, 's': 2, 'z': 3 };
    gameState.myHand.sort((a, b) => {
        const getOrder = (t) => {
            if (['東', '南', '西', '北', '中', '發', '白'].includes(t)) return { s: 'z', n: TILES.honors.indexOf(t) };
            return { s: t.substr(-1), n: parseInt(t) };
        };
        const typeA = getOrder(a);
        const typeB = getOrder(b);
        if (typeA.s !== typeB.s) return suitOrder[typeA.s] - suitOrder[typeB.s];
        return typeA.n - typeB.n;
    });
}

function showActionHint(msg) {
    const el = document.getElementById('actionHint');
    if (el) el.textContent = msg;
}

// 事件綁定
function attachEvents() {
    dom.modeTabs.forEach(btn => {
        btn.addEventListener('click', () => toggleMode(btn.dataset.mode));
    });

    // 對手點擊 (上家/對家/下家)
    [1, 2, 3].forEach(idx => {
        if (dom.opponents[idx]) {
            dom.opponents[idx].addEventListener('click', () => {
                gameState.selectedPlayer = idx;
                gameState.mode = 'record';
                toggleMode('record');
                render();
            });
        }
    });

    dom.drawBtn.addEventListener('click', drawTile);
    dom.sortBtn.addEventListener('click', () => { sortHand(); render(); });
    dom.undoBtn.addEventListener('click', undo);
    dom.resetBtn.addEventListener('click', () => { if (confirm('重置?')) resetGame(); });
}

function toggleMode(mode) {
    gameState.mode = mode;
    dom.modeTabs.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    dom.actionGroups.record.classList.toggle('show', mode === 'record');
    dom.actionGroups.hand.classList.toggle('show', mode === 'hand');

    updatePlayerSelect(); // 更新對手邊框

    if (mode === 'hand') showActionHint('請點選鍵盤，建立或添加手牌');
    else showActionHint(`正在記錄 ${gameState.selectedPlayer === 3 ? '上家' : gameState.selectedPlayer === 2 ? '對家' : '下家'} 的捨牌`);
}

init();
window.gameState = gameState;
