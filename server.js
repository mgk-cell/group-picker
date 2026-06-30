const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve your front-end static files (HTML)
app.use(express.static(path.join(__dirname, 'public')));

// Global state tracking
let total = 0;
let ramaCount = 0;
let krishnaCount = 0;
let taken = new Array(24).fill(false);

// Full detailed database tracking names, groups, and chosen numbers
let masterDatabase = new Array(24).fill(null).map((_, i) => ({
    taken: false,
    name: "",
    group: "",
    number: i + 1
}));

// Route to get current grid state
app.get('/state', (req, res) => {
    res.json({ taken, ramaCount, krishnaCount, total });
});

// Route to pick a number
app.post('/pick', (req, res) => {
    const { index, name } = req.body;
    
    if (index < 0 || index >= 24 || taken[index]) {
        return res.status(400).json({ ok: false, error: 'taken' });
    }

    // Auto-balance teams
    let assignedWord = 'rama';
    if (ramaCount > krishnaCount) {
        assignedWord = 'krishna';
    } else if (krishnaCount > ramaCount) {
        assignedWord = 'rama';
    } else {
        assignedWord = (index % 2 === 0) ? 'rama' : 'krishna';
    }

    // Update system states
    taken[index] = true;
    total++;
    if (assignedWord === 'rama') ramaCount++;
    if (assignedWord === 'krishna') krishnaCount++;

    // Save details to master database
    masterDatabase[index] = {
        taken: true,
        name: name,
        group: assignedWord,
        number: index + 1
    };

    res.json({ ok: true, word: assignedWord, name: name });
});

// SECRET ADMIN VIEW: Only you can look at this data!
// Access by navigating to: your-url.com/groups?secret=myadmin123
app.get('/groups', (req, res) => {
    const clientSecret = req.query.secret;
    
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1><p>You do not have permission to view this layout.</p>');
    }

    const ramaGroup = masterDatabase.filter(p => p.taken && p.group === 'rama');
    const krishnaGroup = masterDatabase.filter(p => p.taken && p.group === 'krishna');

    let htmlOutput = `
    <html>
    <head>
        <title>Admin Panel - Private Group Roster</title>
        <style>
            body { font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; background: #fafafa; }
            .card { background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #ddd; }
            h2 { margin-top: 0; }
            .item { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 16px; }
            .item:last-child { border-bottom: none; }
        </style>
    </head>
    <body>
        <h1>Private Master Dashboard</h1>
        <p>Total participants selected: <strong>${total} / 24</strong></p>
        
        <div class="card" style="border-top: 5px solid #F0997B;">
            <h2 style="color: #712B13;">രാമ ഗ്രൂപ്പ് (${ramaGroup.length})</h2>
            ${ramaGroup.map((p, i) => `<div class="item">${i+1}. <strong>${p.name}</strong> — (Chose No. ${p.number})</div>`).join('') || '<p>No members yet</p>'}
        </div>

        <div class="card" style="border-top: 5px solid #85B7EB;">
            <h2 style="color: #0C447C;">കൃഷ്ണ ഗ്രൂപ്പ് (${krishnaGroup.length})</h2>
            ${krishnaGroup.map((p, i) => `<div class="item">${i+1}. <strong>${p.name}</strong> — (Chose No. ${p.number})</div>`).join('') || '<p>No members yet</p>'}
        </div>
        
        <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer;">Refresh Data</button>
    </body>
    </html>
    `;

    res.send(htmlOutput);
});

// NEW ADDITION: SECRET RESET ROUTE
// Access by navigating to: your-url.com/reset?secret=myadmin123
app.get('/reset', (req, res) => {
    const clientSecret = req.query.secret;
    
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    // Reset everything back to original state
    total = 0;
    ramaCount = 0;
    krishnaCount = 0;
    taken = new Array(24).fill(false);
    masterDatabase = new Array(24).fill(null).map((_, i) => ({
        taken: false,
        name: "",
        group: "",
        number: i + 1
    }));

    res.send('<h1>System Reset Successful ✓</h1><p>The entire grid has been cleared back to its original state. All other phones will update on their next refresh.</p><br><a href="/">Go to Home Grid</a>');
});

app.listen(PORT, () => {
    console.log(`Server executing safely on port ${PORT}`);
});
