const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const GameSchema = new mongoose.Schema({
  id: { type: String, default: 'active_game' },
  words: [String],
  picks: [mongoose.Schema.Types.Mixed],
  resetVersion: { type: Number, default: 1 }
});

const Game = mongoose.model('Game', GameSchema);

function generateRandomizedWords() {
  let arr = Array(12).fill('രാമ').concat(Array(12).fill('കൃഷ്ണ'));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getGameState() {
  let game = await Game.findOne({ id: 'active_game' });
  if (!game) {
    game = await Game.create({
      id: 'active_game',
      words: generateRandomizedWords(),
      picks: new Array(24).fill(null),
      resetVersion: 1
    });
  }
  return game;
}

// Public state including resetVersion so clients know to clear cache
app.get('/state', async (req, res) => {
  try {
    const game = await getGameState();
    const taken = game.picks.map(p => p !== null);
    const ramaCount = game.picks.filter((p, i) => p && game.words[i] === 'രാമ').length;
    const krishnaCount = game.picks.filter((p, i) => p && game.words[i] === 'കൃഷ്ണ').length;
    res.json({ 
      taken, 
      ramaCount, 
      krishnaCount, 
      total: game.picks.filter(p => p !== null).length,
      resetVersion: game.resetVersion || 1
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/pick', async (req, res) => {
  try {
    const { index, name } = req.body;
    if (index < 0 || index > 23) return res.json({ ok: false, error: 'invalid' });
    if (!name || !name.trim()) return res.json({ ok: false, error: 'no name' });

    const game = await getGameState();
    if (game.picks[index] !== null) return res.json({ ok: false, error: 'taken' });

    game.picks[index] = name.trim();
    game.markModified('picks');
    await game.save();

    res.json({ ok: true, word: game.words[index], name: name.trim() });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Database error' });
  }
});

app.get('/admin/dashboard', async (req, res) => {
  try {
    const game = await getGameState();
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Admin Master Dashboard</title>
          <style>
              body { font-family: Arial, sans-serif; background: #111; color: #fff; padding: 20px; }
              h1 { color: #f39c12; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #222; }
              th, td { border: 1px solid #444; padding: 12px; text-align: left; }
              th { background: #333; color: #f1c40f; }
              .rama { color: #3498db; font-weight: bold; }
              .krishna { color: #e74c3c; font-weight: bold; }
              .btn { background: #e74c3c; color: white; padding: 10px 20px; border: none; cursor: pointer; border-radius: 5px; font-size: 16px; margin-top: 20px; }
          </style>
      </head>
      <body>
          <h1>🔒 Master Admin Dashboard (Private View)</h1>
          <p>Total Picked: ${game.picks.filter(p => p !== null).length} / 24</p>
          <a href="/admin/ibuildthisformom" onclick="return confirm('Are you sure you want to reset everything and force-wipe all user names and sessions?');"><button class="btn">Full Hard Reset & Reshuffle</button></a>
          <table>
              <tr>
                  <th>Box #</th>
                  <th>Assigned Word</th>
                  <th>Picked By Name</th>
              </tr>
    `;

    for (let i = 0; i < 24; i++) {
      const wordClass = game.words[i] === 'രാമ' ? 'rama' : 'krishna';
      const pickStatus = game.picks[i] ? `<span style="color:#2ecc71;">${game.picks[i]}</span>` : `<span style="color:#777;">[Available]</span>`;
      html += `
        <tr>
            <td>Box ${i + 1}</td>
            <td class="${wordClass}">${game.words[i]}</td>
            <td>${pickStatus}</td>
        </tr>
      `;
    }

    html += `
          </table>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send('Error loading dashboard');
  }
});

// SECRET ADMIN HARD RESET (Bumps version to force-wipe all client localStorage caches)
app.get('/admin/ibuildthisformom', async (req, res) => {
  try {
    const newWords = generateRandomizedWords();
    const newPicks = new Array(24).fill(null);
    
    const game = await Game.findOne({ id: 'active_game' });
    const currentVersion = game ? (game.resetVersion || 1) : 1;

    await Game.findOneAndUpdate(
      { id: 'active_game' },
      { words: newWords, picks: newPicks, resetVersion: currentVersion + 1 },
      { upsert: true }
    );

    res.send('Hard reset complete! All data wiped, fresh shuffle generated, and client sessions invalidated. <a href="/admin/dashboard">Go to Admin Dashboard</a>');
  } catch (err) {
    res.status(500).send('Reset failed.');
  }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
