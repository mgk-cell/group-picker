const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state tracking
let total = 0;
let ramaCount = 0;
let krishnaCount = 0;
let taken = new Array(24).fill(false);

// Master assignment pool (12 Rama slots, 12 Krishna slots)
// 10 slots per team have dashakams (total 100), 2 extra slots have no dashakams
let assignmentPool = [];

function generateRandomPool() {
    const dashakamRanges = [
        "1-10", "11-20", "21-30", "31-40", "41-50", 
        "51-60", "61-70", "71-80", "81-90", "91-100"
    ];
    
    let pool = [];
    
    // Add the 10 Rama slots with dashakams
    dashakamRanges.forEach(range => pool.push({ group: 'rama', range: range }));
    // Add the 2 extra Rama slots with no dashakams
    pool.push({ group: 'rama', range: null });
    pool.push({ group: 'rama', range: null });
    
    // Add the 10 Krishna slots with dashakams
    dashakamRanges.forEach(range => pool.push({ group: 'krishna', range: range }));
    // Add the 2 extra Krishna slots with no dashakams
    pool.push({ group: 'krishna', range: null });
    pool.push({ group: 'krishna', range: null });
    
    // Shuffle the pool using Fisher-Yates algorithm for perfect randomness
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    return pool;
}

// Initialize the random pool
assignmentPool = generateRandomPool();

// Track data submitted for each of the 24 numbered grid boxes
let masterDatabase = new Array(24).fill(null).map((_, i) => ({
    taken: false,
    name: "",
    group: "",
    range: null,
    number: i + 1
}));

app.get('/state', (req, res) => {
    res.json({ taken, ramaCount, krishnaCount, total });
});

app.post('/pick', (req, res) => {
    const { index, name } = req.body;
    
    if (index < 0 || index >= 24 || taken[index]) {
        return res.status(400).json({ ok: false, error: 'taken' });
    }

    // Pull the next random assignment from our shuffled pool
    const assignment = assignmentPool[total];

    taken[index] = true;
    total++;
    
    if (assignment.group === 'rama') ramaCount++;
    if (assignment.group === 'krishna') krishnaCount++;

    masterDatabase[index] = {
        taken: true,
        name: name,
        group: assignment.group,
        range: assignment.range,
        number: index + 1
    };

    res.json({ 
        ok: true, 
        word: assignment.group, 
        range: assignment.range, 
        name: name 
    });
});

// SECRET ADMIN VIEW
app.get('/groups', (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    const ramaGroup = masterDatabase.filter(p => p.taken && p.group === 'rama');
    const krishnaGroup = masterDatabase.filter(p => p.taken && p.group === 'krishna');

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
        <p>Total participants registered: <strong>${total} / 24</strong></p>
        
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

// SECRET RESET ROUTE
app.get('/reset', (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    total = 0;
    ramaCount = 0;
    krishnaCount = 0;
    taken = new Array(24).fill(false);
    assignmentPool = generateRandomPool(); // Reroll absolute randomness
    masterDatabase = new Array(24).fill(null).map((_, i) => ({
        taken: false,
        name: "",
        group: "",
        range: null,
        number: i + 1
    }));

    res.send('<h1>System Reset Successful ✓</h1><p>The entire parayan schedule has been cleared and completely randomized again.</p><br><a href="/">Go to Home Grid</a>');
});

app.listen(PORT, () => {
    console.log(`Server executing safely on port ${PORT}`);
});
