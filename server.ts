import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(process.cwd(), 'evaluations.json');
const DRAFTS_FILE = path.join(process.cwd(), 'drafts.json');

// Load data helper
function loadData(file: string) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      return file === DRAFTS_FILE ? {} : [];
    }
  }
  return file === DRAFTS_FILE ? {} : [];
}

// Save data helper
function saveData(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Data storage - Pre-approved students
  const students = [
    { id: '1', name: 'Zouheir' },
    { id: '2', name: 'Manale' },
    { id: '3', name: 'Hanae' },
    { id: '4', name: 'Ilayase' },
    { id: '5', name: 'Mohamed Amine' },
    { id: '6', name: 'Mohamed' },
    { id: '7', name: 'Talale' },
    { id: '8', name: 'Assia' },
    { id: '9', name: 'Hayate' },
    { id: '10', name: 'Hada' },
    { id: '11', name: 'Moha' },
    { id: '12', name: 'Fatima' },
    { id: '13', name: 'Zahra' },
    { id: '14', name: 'Souade' },
    { id: '15', name: 'Lamyae' },
    { id: '16', name: 'Sade' },
    { id: '17', name: 'Soufine' },
    { id: '18', name: 'Imame' },
    { id: '19', name: 'Zakariae' },
    { id: '20', name: 'Raine' },
  ];

  let evaluations: { evaluatorId: string; submissions: { studentId: string; score: number; comment?: string }[] }[] = loadData(DATA_FILE);
  let drafts: Record<string, any> = loadData(DRAFTS_FILE);

  // API Routes
  app.get('/api/students', (req, res) => {
    res.json(students);
  });

  app.get('/api/draft/:studentId', (req, res) => {
    const { studentId } = req.params;
    res.json({ draft: drafts[studentId] || null });
  });

  app.post('/api/draft', (req, res) => {
    const { studentId, submissions } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Student ID required' });
    
    drafts[studentId] = submissions;
    saveData(DRAFTS_FILE, drafts);
    res.json({ success: true });
  });

  app.post('/api/admin/reset', (req, res) => {
    evaluations = [];
    drafts = {};
    saveData(DATA_FILE, evaluations);
    saveData(DRAFTS_FILE, drafts);
    res.json({ success: true, message: 'All data has been reset.' });
  });

  app.post('/api/login', (req, res) => {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Student ID is required.' });
    }

    const student = students.find(s => s.id === id);

    if (!student) {
      return res.status(401).json({ error: 'Identity not recognized.' });
    }

    // Check if already voted
    const alreadyVoted = evaluations.some(e => e.evaluatorId === id);
    
    res.json({ 
        success: true, 
        student: { id: student.id, name: student.name },
        alreadyVoted
    });
  });

  app.post('/api/evaluate', (req, res) => {
    const { evaluatorId, submissions } = req.body;

    if (!evaluatorId || !submissions) {
      return res.status(400).json({ error: 'Incomplete submission data.' });
    }

    // Check if already submitted
    if (evaluations.some(e => e.evaluatorId === evaluatorId)) {
      return res.status(400).json({ error: 'Your evaluation has already been recorded.' });
    }

    // Validate self-scoring
    if (submissions.some((s: any) => s.studentId === evaluatorId)) {
      return res.status(400).json({ error: 'You cannot evaluate yourself.' });
    }

    // Validate all other students are evaluated
    const otherStudentsCount = students.length - 1;
    if (submissions.length < otherStudentsCount) {
        return res.status(400).json({ error: `Please evaluate all ${otherStudentsCount} other students.` });
    }

    evaluations.push({ evaluatorId, submissions });
    saveData(DATA_FILE, evaluations);
    
    // Clear draft after successful submission
    if (drafts[evaluatorId]) {
      delete drafts[evaluatorId];
      saveData(DRAFTS_FILE, drafts);
    }
    
    res.json({ success: true });
  });

  app.get('/api/results', (req, res) => {
    const resultsMap: Record<string, { totalScore: number; count: number }> = {};
    
    // Initialize results map
    students.forEach(s => {
      resultsMap[s.id] = { totalScore: 0, count: 0 };
    });

    // Calculate totals
    evaluations.forEach(evalEntry => {
      evalEntry.submissions.forEach(sub => {
        if (resultsMap[sub.studentId]) {
          resultsMap[sub.studentId].totalScore += sub.score;
          resultsMap[sub.studentId].count += 1;
        }
      });
    });

    // Format results
    const results = students.map(s => {
      const data = resultsMap[s.id];
      const average = data.count > 0 ? Number((data.totalScore / data.count).toFixed(2)) : 0;
      return {
        id: s.id,
        name: s.name,
        average,
        count: data.count
      };
    });

    // Sort by average DESC
    results.sort((a, b) => b.average - a.average);

    res.json({
        totalSubmissions: evaluations.length,
        results
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
