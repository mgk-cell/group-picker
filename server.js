const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'registrations.json');
const ADMIN_PIN = "1234"; // Change your secret Admin PIN here

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load stored data safely
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Save data back to file
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 1. Fetch booked numbers & list
app.get('/api/data', (req, res) => {
  const records = loadData();
  const takenNumbers = records.map(r => r.number);
  res.json({ takenNumbers, records });
});

// 2. Submit entry
app.post('/api/submit', (req, res) => {
  const { name, number } = req.body;
  const num = parseInt(number, 10);

  if (!name || isNaN(num) || num < 1 || num > 24) {
    return res.status(400).json({ status: 'error', message: 'അസാധുവായ വിവരങ്ങൾ!' });
  }

  const records = loadData();
  if (records.some(r => r.number === num)) {
    return res.json({ status: 'taken', message: 'ഈ നമ്പർ ইতোমধ্যে തിരഞ്ഞെടുക്കപ്പെട്ടു!' });
  }

  const group = num <= 12 ? 'കൃഷ്ണ ഗ്രൂപ്പ് (Krishna Group)' : 'രാമ ഗ്രൂപ്പ് (Rama Group)';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const newEntry = { name, number: num, group, timestamp };
  records.push(newEntry);
  saveData(records);

  res.json({ status: 'success', group, number: num });
});

// 3. Admin Reset
app.post('/api/reset', (req, res) => {
  const { pin } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ status: 'error', message: 'തെറ്റായ PIN!' });
  }

  saveData([]);
  res.json({ status: 'success', message: 'ഡാറ്റ റീസെറ്റ് ചെയ്തു!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
