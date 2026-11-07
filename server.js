const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Uses your existing environment variable for MongoDB Atlas connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Database Schema
const GameSchema = new mongoose.Schema({
  id: { type: String, default: 'active_game' },
  words: [String],
  picks: [mongoose.Schema.Types.Mixed]
});

const Game = mongoose.model('Game', GameSchema);

// True cryptographic Fisher-Yates Shuffle using crypto.randomInt
function generateRandomizedWords() {
  let arr = Array(12).fill('രാമ').concat(Array(12).fill('കൃഷ്ണ'));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper to get or initialize database game state
async function getGameState() {
  let game = await Game.findOne({ id: 'active_game' });
  if (!game) {
    game = await Game.create({
      id: 'active_game',
      words: generateRandomizedWords(),
      picks: new Array(24).fill(null)
    });
  }
  return game;
}

// Get current public state across phones
app.get('/state', async (req, res) => {
  try {
    const game = await getGameState();
    const taken = game.picks.map(p => p !== null);
    const ramaCount = game.picks.filter((p, i) => p && game.words[i] === 'രാമ').length;
    const krishnaCount = game.picks.filter((p, i) => p && game.words[i] === 'കൃഷ്ണ').length;
    res.json({ taken, ramaCount, krishnaCount, total: game.picks.filter(p => p !== null).length });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Pick a box route
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

// Get group results
app.get('/groups', async (req, res) => {
  try {
    const game = await getGameState();
    const rama = [];
    const krishna = [];
    game.picks.forEach((name, i) => {
      if (name) {
        if (game.words[i] === 'രാമ') rama.push(name);
        else krishna.push(name);
      }
    });
    res.json({ rama, krishna });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});


app.get('/admin/ibuildthisformom', async (req, res) => {
  try {
    const newWords = generateRandomizedWords();
    const newPicks = new Array(24).fill(null);

    await Game.findOneAndUpdate(
      { id: 'active_game' },
      { words: newWords, picks: newPicks },
      { upsert: true }
    );

    res.send('Reset done. DB updated with fresh cryptographic random shuffle.');
  } catch (err) {
    res.status(500).send('Reset failed due to database error.');
  }
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
