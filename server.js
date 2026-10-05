const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = "1234"; 

// 1. Connect to MongoDB Cloud (Replaces local file)
const MONGO_URI = process.env.MONGO_URI || "YOUR_MONGODB_CONNECTION_STRING_HERE";

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to Cloud Database!'))
  .catch(err => console.error('MongoDB Error:', err));

// 2. Define Registration Schema
const registrationSchema = new mongoose.Schema({
  name: String,
  number: Number,
  group: String,
  timestamp: String
});

const Registration = mongoose.model('Registration', registrationSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fetch booked numbers & registrations
app.get('/api/data', async (req, res) => {
  try {
    const records = await Registration.find({});
    const takenNumbers = records.map(r => r.number);
    res.json({ takenNumbers, records });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to load data' });
  }
});

// Submit user selection
app.post('/api/submit', async (req, res) => {
  const { name, number } = req.body;
  const num = parseInt(number, 10);

  if (!name || isNaN(num) || num < 1 || num > 24) {
    return res.status(400).json({ status: 'error', message: 'അസാധുവായ വിവരങ്ങൾ!' });
  }

  try {
    const existing = await Registration.findOne({ number: num });
    if (existing) {
      return res.json({ status: 'taken', message: 'ഈ നമ്പർ ইতোমধ্যে തിരഞ്ഞെടുക്കപ്പെട്ടു!' });
    }

    const group = num <= 12 ? 'കൃഷ്ണ ഗ്രൂപ്പ് (Krishna Group)' : 'രാമ ഗ്രൂപ്പ് (Rama Group)';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const newEntry = new Registration({ name, number: num, group, timestamp });
    await newEntry.save();

    res.json({ status: 'success', group, number: num });
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
