const express = require('express');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// 🎪 TRIGGA GOD STATS
let TRIGGA = {
  sent: 0, rotations: 0, errors: 0, 
  active: false, progress: 0,
  currentSMTP: '', targets: 0,
  start: Date.now()
};

// 🔑 HARVARD AUTH KEY
const TRIGGA_KEY = process.env.TRIGGA_KEY || 'MAGIC-TRIGGA-HARVARD-2025';

// 🪄 SMTP HARVESTERS (3x Battle-Tested)
const SMTP_HARVESTERS = [
  {
    name: 'GuerrillaMail Pro', 
    harvest: async () => {
      const { data } = await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address');
      return {
        user: data.email_addr,
        pass: data.sid_token,
        host: 'smtp.guerrillamail.com',
        port: 587
      };
    }
  },
  {
    name: 'TempMail Elite',
    harvest: async () => {
      const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
      const page = await browser.newPage();
      await page.goto('https://temp-mail.org/en/');
      await page.click('.btn-generate');
      await page.waitForSelector('.mail-address');
      const email = await page.$eval('.mail-address', el => el.textContent);
      await browser.close();
      return { user: email, pass: `trigga_${Date.now()}`, host: 'smtp.temp-mail.org', port: 587 };
    }
  },
  {
    name: '10MinuteMail X',
    harvest: async () => {
      const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
      const page = await browser.newPage();
      await page.goto('https://10minutemail.com/10MinuteMail/resources/system/iframe.html');
      await page.waitForSelector('#eml');
      const email = await page.$eval('#eml', el => el.value);
      await browser.close();
      return { user: email, pass: `trigga_${Date.now()}`, host: 'smtp.10minutemail.com', port: 587 };
    }
  }
];

// 🔥 HARVEST FRESH SMTP
async function harvestSMTP() {
  const harvester = SMTP_HARVESTERS[TRIGGA.rotations % SMTP_HARVESTERS.length];
  TRIGGA.currentSMTP = harvester.name;
  
  try {
    const smtp = await harvester.harvest();
    TRIGGA.rotations++;
    return smtp;
  } catch(e) {
    TRIGGA.errors++;
    throw e;
  }
}

// 💥 EMAIL CANNON
async function blastEmails(smtp, targets, template) {
  const transporter = nodemailer.createTransporter({
    host: smtp.host, port: smtp.port,
    secure: false, auth: { user: smtp.user, pass: smtp.pass },
    pool: true, maxConnections: 15, maxMessages: 500
  });

  const results = [];
  for (const target of targets) {
    const subject = template.subject.replace('{{target}}', target);
    const html = template.html
      .replace(/{{target}}/g, target)
      .replace(/{{id}}/g, TRIGGA.sent)
      .replace(/{{sender}}/g, smtp.user)
      .replace(/{{phish}}/g, template.phishLink || '#');

    try {
      await transporter.sendMail({ from: smtp.user, to: target, subject, html });
      TRIGGA.sent++;
      results.push({ target, status: '✅ FIRED' });
    } catch(e) {
      TRIGGA.errors++;
      results.push({ target, status: '💥 MISS' });
    }
  }
  return results;
}

// 🎪 TRIGGA BLAST API (SSE Streaming)
app.post('/api/blast', async (req, res) => {
  const { key, targets, template, phishLink } = req.body;
  
  if (key !== TRIGGA_KEY) return res.status(401).json({error: '🚫 UNAUTHORIZED'});
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  TRIGGA = { ...TRIGGA, active: true, targets: targets.length, progress: 0, start: Date.now() };

  try {
    const burstSize = 25;
    for (let i = 0; i < targets.length; i += burstSize) {
      const batch = targets.slice(i, i + burstSize);
      const smtp = await harvestSMTP();
      
      const results = await blastEmails(smtp, batch, { ...template, phishLink });
      
      const progress = Math.round((i + batch.length) / targets.length * 100);
      TRIGGA.progress = progress;
      
      res.write(`data: ${JSON.stringify({
        progress, sent: TRIGGA.sent, smtp: smtp.user.slice(0,25) + '...',
        batch: results.length, eta: Math.round((targets.length - i) / 50) + 's'
      })} \n\n`);
      
      await new Promise(r => setTimeout(r, 1500));
    }
    
    res.end(`data: ${JSON.stringify({ done: true, total: TRIGGA.sent })} \n\n`);
  } catch(e) {
    res.end(`data: ${JSON.stringify({ error: e.message })} \n\n`);
  }
});

// 📊 DASHBOARD
app.get('/api/stats', (req, res) => res.json(TRIGGA));
app.get('/api/report', (req, res) => {
  const report = `MAGICSENDER BY TRIGGA REPORT\nSent: ${TRIGGA.sent} | Rotations: ${TRIGGA.rotations}`;
  res.attachment('trigga-report.txt');
  res.send(report);
});

app.get('/', (req, res) => res.render('index'));

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`\n🎪 MAGICSENDER BY TRIGGA v3.0 LIVE → PORT ${PORT}`);
  console.log(`🔑 KEY: ${TRIGGA_KEY}`);
  console.log(`🎯 READY TO ANNIHILATE → https://your-app.railway.app`);
});
