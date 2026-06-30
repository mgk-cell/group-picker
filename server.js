const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Path pointing to the secure, free Render disk mount folder
const DATA_FILE = '/data/data.json';

let state = {
    total: 0,
    ramaCount: 0,
    krishnaCount: 0,
    taken: new Array(24).fill(false),
    assignmentPool: [],
    masterDatabase: new Array(24).fill(null).map((_, i) => ({
        taken: false,
        name: "",
        group: "",
        range: null,
        number: i + 1
    }))
};

function generateRandomPool() {
    const dashakamRanges = [
        "1-10", "11-20", "21-30", "31-40", "41-50", 
        "51-60", "61-70", "71-80", "81-90", "91-100"
    ];
    let pool = [];
    dashakamRanges.forEach(range => pool.push({ group: 'rama', range: range }));
    pool.push({ group: 'rama', range: null }, { group: 'rama', range: null });
    dashakamRanges.forEach(range => pool.push({ group: 'krishna', range: range }));
    pool.push({ group: 'krishna', range: null }, { group: 'krishna', range: null });

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
}

// Check if the secure data folder exists, read it, or create a fresh pool
if (fs.existsSync(DATA_FILE)) {
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        state = JSON.parse(rawData);
        console.log("✓ Saved data restored successfully!");
    } catch (e) {
        console.log("Error reading save file, starting fresh pool.");
        state.assignmentPool = generateRandomPool();
    }
} else {
    state.assignmentPool = generateRandomPool();
    // Ensure the directory exists before writing to it
    if (!fs.existsSync('/data')) {
        fs.mkdirSync('/data', { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function saveToDisk() {
    if (!fs.existsSync('/data')) {
        fs.mkdirSync('/data', { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

app.get('/state', (req, res) => {
    res.json({ 
        taken: state.taken, 
        ramaCount: state.ramaCount, 
        krishnaCount: state.krishnaCount, 
        total: state.total 
    });
});

app.post('/pick', (req, res) => {
    const { index, name } = req.body;
    
    if (index < 0 || index >= 24 || state.taken[index]) {
        return res.status(400).json({ ok: false, error: 'taken' });
    }

    const assignment = state.assignmentPool[state.total];

    state.taken[index] = true;
    state.total++;
    
    if (assignment.group === 'rama') state.ramaCount++;
    if (assignment.group === 'krishna') state.krishnaCount++;

    state.masterDatabase[index] = {
        taken: true,
        name: name,
        group: assignment.group,
        range: assignment.range,
        number: index + 1
    };

    saveToDisk();

    res.json({ 
        ok: true, 
        word: assignment.group, 
        range: assignment.range, 
        name: name 
    });
});

app.get('/groups', (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    const ramaGroup = state.masterDatabase.filter(p => p.taken && p.group === 'rama');
    const krishnaGroup = state.masterDatabase.filter(p => p.taken && p.group === 'krishna');

    let htmlOutput = `
    <html>
    <head>
        <title>Admin Panel - Private Group Roster</title>
        <style>
            body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #fafafa; color: #333; }
            .card { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #ddd; }
            h2 { margin-top: 0; }
            .item { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 16px; display: flex; justify-content: space-between; }
            .item:last-child { border-bottom: none; }
            .dashakam-tag { background: #eee; padding: 2px 8px; border-radius: 6px; font-size: 14px; font-weight: bold; }
            .rama-tag { background: #FFF3EE; color: #712B13; }
            .krishna-tag { background: #E6F1FB; color: #0C447C; }
        </style>
    </head>
    <body>
        <h1>ശ്രീ നാരായണീയം പാരായണം - Dashboard</h1>
        <p>Total participants registered: <strong>${state.total} / 24</strong></p>
        
        <div class="card" style="border-top: 5px solid #F0997B;">
            <h2 style="color: #712B13;">രാമ ഗ്രൂപ്പ് (${ramaGroup.length} / 12)</h2>
            ${ramaGroup.map((p, i) => `
                <div class="item">
                    <span>${i+1}. <strong>${p.name}</strong> (Box No. ${p.number})</span>
                    <span class="dashakam-tag rama-tag">${p.range ? 'ദശകം ' + p.range : 'Extra Member'}</span>
                </div>
            `).join('') || '<p>No members yet</p>'}
        </div>

        <div class="card" style="border-top: 5px solid #85B7EB;">
            <h2 style="color: #0C447C;">കൃഷ്ണ ഗ്രൂപ്പ് (${krishnaGroup.length} / 12)</h2>
            ${krishnaGroup.map((p, i) => `
                <div class="item">
                    <span>${i+1}. <strong>${p.name}</strong> (Box No. ${p.number})</span>
                    <span class="dashakam-tag krishna-tag">${p.range ? 'ദശകം ' + p.range : 'Extra Member'}</span>
                </div>
            `).join('') || '<p>No members yet</p>'}
        </div>
        
        <button onclick="window.location.reload()" style="padding: 12px 24px; cursor: pointer; border-radius: 6px; border: 1px solid #ccc; background: white; font-weight: bold;">Refresh Data</button>
    </body>
    </html>
    `;
    res.send(htmlOutput);
});

app.get('/reset', (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    state.total = 0;
    state.ramaCount = 0;
    state.krishnaCount = 0;
    state.taken = new Array(24).fill(false);
    state.assignmentPool = generateRandomPool();
    state.masterDatabase = new Array(24).fill(null).map((_, i) => ({
        taken: false,
        name: "",
        group: "",
        range: null,
        number: i + 1
    }));

    saveToDisk();

    res.send('<h1>System Reset Successful ✓</h1><p>The saved data file has been completely wiped and randomized freshly.</p><br><a href="/">Go to Home Grid</a>');
});

app.listen(PORT, () => {
    console.log(`Server executing safely on port ${PORT}`);
});
