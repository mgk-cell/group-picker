const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = "1234"; 

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mrmadhavgkrishna_db_user:oEyKtkmIa5VkyIn2@cluster0.0mhhjmg.mongodb.net/group-picker?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to Database'))
  .catch(err => console.error('Database Error:', err));

const registrationSchema = new mongoose.Schema({
  name: String,
  number: Number,
  group: String,
  timestamp: String
});

const Registration = mongoose.model('Registration', registrationSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fetch status & records
app.get('/api/data', async (req, res) => {
  try {
    const records = await Registration.find({});
    const takenNumbers = records.map(r => r.number);
    res.json({ takenNumbers, records });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to load data' });
  }
});

// Submit User Choice
app.post('/api/submit', async (req, res) => {
  const { name, number } = req.body;
  const num = parseInt(number, 10);

  if (!name || name.trim() === '' || isNaN(num) || num < 1 || num > 24) {
    return res.status(400).json({ status: 'error', message: 'ദയവായി പേരും നമ്പറും നൽകുക! (Please enter name & select a valid number)' });
  }

  try {
    const records = await Registration.find({});

    // 1. Check if chosen number is already taken
    const existing = records.find(r => r.number === num);
    if (existing) {
      return res.json({ status: 'taken', message: 'ഈ നമ്പർ ইতোমধ্যে തിരഞ്ഞെടുക്കപ്പെട്ടു! (Number already taken!)' });
    }

    // 2. Count current groups across all picked numbers
    const krishnaCount = records.filter(r => r.group.includes('കൃഷ്ണ')).length;
    const ramaCount = records.filter(r => r.group.includes('രാമ')).length;

    // 3. Determine available groups to ensure exactly 12 of each in total
    const availableGroups = [];
    if (krishnaCount < 12) availableGroups.push('കൃഷ്ണ ഗ്രൂപ്പ് (Krishna Group)');
    if (ramaCount < 12) availableGroups.push('രാമ ഗ്രൂപ്പ് (Rama Group)');

    // 4. Randomly assign one of the available groups to this chosen number
    const assignedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Save to Database
    const newEntry = new Registration({
      name: name.trim(),
      number: num,
      group: assignedGroup,
      timestamp
    });

    await newEntry.save();

    res.json({
      status: 'success',
      name: name.trim(),
      group: assignedGroup,
      number: num
    });

  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Admin Reset
app.post('/api/reset', async (req, res) => {
  const { pin } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ status: 'error', message: 'തെറ്റായ PIN! (Wrong PIN)' });
  }

  try {
    await Registration.deleteMany({});
    res.json({ status: 'success', message: 'ഡാറ്റ റീസെറ്റ് ചെയ്തു! (Data reset successful)' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Reset failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
