const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = "imadethisnotforfu1"; 

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

// Public route: ONLY returns which numbers are taken (No names, no groups)
app.get('/api/data', async (req, res) => {
  try {
    const records = await Registration.find({}, 'number');
    const takenNumbers = records.map(r => r.number);
    res.json({ takenNumbers });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to load data' });
  }
});

// PRIVATE Admin route: Requires PIN to view full records
app.post('/api/admin/data', async (req, res) => {
  const { pin } = req.body;
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ status: 'error', message: 'തെറ്റായ PIN! (Unauthorized access)' });
  }

  try {
    const records = await Registration.find({});
    res.json({ status: 'success', records });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to load admin data' });
  }
});

// Submit User Choice
app.post('/api/submit', async (req, res) => {
  const { name, number } = req.body;
  const num = parseInt(number, 10);

  if (!name || name.trim() === '' || isNaN(num) || num < 1 || num > 24) {
    return res.status(400).json({ status: 'error', message: 'ദയവായി പേരും നമ്പറും നൽകുക!' });
  }

  try {
    const records = await Registration.find({});

    const existing = records.find(r => r.number === num);
    if (existing) {
      return res.json({ status: 'taken', message: 'ഈ നമ്പർ ইতোমধ্যে തിരഞ്ഞെടുക്കപ്പെട്ടു!' });
    }

    const krishnaCount = records.filter(r => r.group.includes('കൃഷ്ണ')).length;
    const ramaCount = records.filter(r => r.group.includes('രാമ')).length;

    const availableGroups = [];
    if (krishnaCount < 12) availableGroups.push('കൃഷ്ണ ഗ്രൂപ്പ് (Krishna Group)');
    if (ramaCount < 12) availableGroups.push('രാമ ഗ്രൂപ്പ് (Rama Group)');

    const assignedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

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
    return res.status(401).json({ status: 'error', message: 'തെറ്റായ PIN!' });
  }

  try {
    await Registration.deleteMany({});
    res.json({ status: 'success', message: 'ഡാറ്റ റീസെറ്റ് ചെയ്തു!' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Reset failed' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
