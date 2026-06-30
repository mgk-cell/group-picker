const express = require('express');
const path = require('path');
const { Client } = require('pg'); // Pure PostgreSQL client for Supabase cloud storage

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to your free Supabase database securely using Render environment variables
const dbClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

dbClient.connect()
    .then(() => {
        console.log("✓ Connected to Supabase Cloud Database successfully!");
        return initializeDatabase();
    })
    .catch(err => console.error("Database connection error: ", err));

// Helper function to generate a brand new randomized pool
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

// Automatically create tables and insert initial state if the database is completely empty
async function initializeDatabase() {
    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS system_state (
            id SERIAL PRIMARY KEY,
            total INT DEFAULT 0,
            rama_count INT DEFAULT 0,
            krishna_count INT DEFAULT 0,
            taken BOOLEAN[] DEFAULT '{}',
            assignment_pool JSONB DEFAULT '[]',
            master_database JSONB DEFAULT '[]'
        );
    `);

    const res = await dbClient.query('SELECT * FROM system_state LIMIT 1;');
    if (res.rows.length === 0) {
        const defaultPool = generateRandomPool();
        const defaultMaster = new Array(24).fill(null).map((_, i) => ({
            taken: false, name: "", group: "", range: null, number: i + 1
        }));
        const defaultTaken = new Array(24).fill(false);

        await dbClient.query(`
            INSERT INTO system_state (total, rama_count, krishna_count, taken, assignment_pool, master_database)
            VALUES ($1, $2, $3, $4, $5, $6);
        `, [0, 0, 0, defaultTaken, JSON.stringify(defaultPool), JSON.stringify(defaultMaster)]);
        console.log("✓ Initialized default app structure inside Supabase cloud storage!");
    }
}

// Fetch live state straight from cloud DB
async function getState() {
    const res = await dbClient.query('SELECT * FROM system_state LIMIT 1;');
    return res.rows[0];
}

app.get('/state', async (req, res) => {
    try {
        const state = await getState();
        res.json({ 
            taken: state.taken, 
            ramaCount: state.rama_count, 
            krishnaCount: state.krishna_count, 
            total: state.total 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/pick', async (req, res) => {
    try {
        const { index, name } = req.body;
        const state = await getState();
        
        if (index < 0 || index >= 24 || state.taken[index]) {
            return res.status(400).json({ ok: false, error: 'taken' });
        }

        const assignment = state.assignment_pool[state.total];
        state.taken[index] = true;
        state.total++;
        
        if (assignment.group === 'rama') state.rama_count++;
        if (assignment.group === 'krishna') state.krishna_count++;

        state.master_database[index] = {
            taken: true,
            name: name,
            group: assignment.group,
            range: assignment.range,
            number: index + 1
        };

        // Instantly save choices back to the database cloud row
        await dbClient.query(`
            UPDATE system_state 
            SET total = $1, rama_count = $2, krishna_count = $3, taken = $4, master_database = $5
            WHERE id = $6;
        `, [state.total, state.rama_count, state.krishna_count, state.taken, JSON.stringify(state.master_database), state.id]);

        res.json({ 
            ok: true, 
            word: assignment.group, 
            range: assignment.range, 
            name: name 
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ADMIN VIEW
app.get('/groups', async (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    const state = await getState();
    const ramaGroup = state.master_database.filter(p => p.taken && p.group === 'rama');
    const krishnaGroup = state.master_database.filter(p => p.taken && p.group === 'krishna');

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

// SYSTEM RESET ROUTE
app.get('/reset', async (req, res) => {
    const clientSecret = req.query.secret;
    if (clientSecret !== 'myadmin123') {
        return res.status(403).send('<h1>Access Denied</h1>');
    }

    const state = await getState();
    const defaultPool = generateRandomPool();
    const defaultMaster = new Array(24).fill(null).map((_, i) => ({
        taken: false, name: "", group: "", range: null, number: i + 1
    }));
    const defaultTaken = new Array(24).fill(false);

    await dbClient.query(`
        UPDATE system_state 
        SET total = $1, rama_count = $2, krishna_count = $3, taken = $4, assignment_pool = $5, master_database = $6
        WHERE id = $7;
    `, [0, 0, 0, defaultTaken, JSON.stringify(defaultPool), JSON.stringify(defaultMaster), state.id]);

    res.send('<h1>System Reset Successful ✓</h1><p>The database has been wiped clean and randomized freshly.</p><br><a href="/">Go to Home Grid</a>');
});

app.listen(PORT, () => {
    console.log(`Server executing safely on port ${PORT}`);
});
