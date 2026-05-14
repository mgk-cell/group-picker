const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let words = Array(12).fill('rama').concat(Array(12).fill('krishna'));
for (let i = words.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [words[i], words[j]] = [words[j], words[i]];
}

let picks = new Array(24).fill(null);

app.get('/state', (req, res) => {
  const taken = picks.map(p => p !== null);
  const ramaCount = picks.filter((p, i) => p && words[i] === 'rama').length;
  const krishnaCount = picks.filter((p, i) => p && words[i] === 'krishna').length;
  res.json({ taken, ramaCount, krishnaCount, total: picks.filter(p => p).length });
});

app.post('/pick', (req, res) => {
  const { index, name } = req.body;
  if (index < 0 || index > 23) return res.json({ ok: false, error: 'invalid' });
  if (picks[index] !== null) return res.json({ ok: false, error: 'taken' });
  if (!name || !name.trim()) return res.json({ ok: false, error: 'no name' });
  picks[index] = name.trim();
  res.json({ ok: true, word: words[index], name: name.trim() });
});

app.get('/groups', (req, res) => {
  const rama = [], krishna = [];
  picks.forEach((name, i) => {
    if (name) words[i] === 'rama' ? rama.push(name) : krishna.push(name);
  });
  res.json({ rama, krishna });
});

app.get('/admin/ibuildthisformom', (req, res) => {
  words = Array(12).fill('rama').concat(Array(12).fill('krishna'));
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  picks = new Array(24).fill(null);
  res.send('Reset done. All 24 boxes are fresh.');
});

app.listen(PORT, () => console.log('Running on port ' + PORT));
