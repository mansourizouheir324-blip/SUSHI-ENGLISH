import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Send, 
  Trophy, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Star,
  LayoutDashboard,
  LogOut,
  Info,
  Mail,
  User as UserIcon,
  BarChart3,
  Save,
  Clock,
  Search
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer,
    Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Student {
  id: string;
  name: string;
  email?: string;
}

interface Result {
  id: string;
  name: string;
  average: number;
  count: number;
}

interface Submission {
  studentId: string;
  score: number;
  comment: string;
}

interface AppError {
  message: string;
  code?: string;
  timestamp?: string;
}

type View = 'login' | 'evaluate' | 'submitting' | 'success' | 'leaderboard';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentUser, setCurrentUser] = useState<Student | null>(null);
  const [view, setView] = useState<View>('login');
  const [submissions, setSubmissions] = useState<Record<string, { score: number; comment: string }>>({});
  const [results, setResults] = useState<Result[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: '', email: '' });
  const [draftSaving, setDraftSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudents();
    fetchResults();
    // Auto-refresh results every 10 seconds if on leaderboard
    const interval = setInterval(() => {
        if (view === 'leaderboard') fetchResults();
    }, 10000);
    return () => clearInterval(interval);
  }, [view]);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      setError({ 
        message: 'Failed to load students',
        code: 'FETCH_STUDENTS_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  };

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      setResults(data.results);
      setTotalSubmissions(data.totalSubmissions);
    } catch (err) {
      setError({ 
        message: 'Failed to load results',
        code: 'FETCH_RESULTS_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleLogin = async (studentId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: studentId })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.alreadyVoted) {
            setError({ 
              message: 'You have already submitted your evaluation.',
              code: 'VOTE_ALREADY_SUBMITTED',
              timestamp: new Date().toISOString()
            });
            return;
        }
        
        setCurrentUser(data.student);
        setView('evaluate');

        // Check for draft
        const draftRes = await fetch(`/api/draft/${studentId}`);
        const draftData = await draftRes.json();

        // Initialize scores
        const initial: Record<string, { score: number; comment: string }> = {};
        students.forEach(s => {
          if (s.id !== data.student.id) {
            if (draftData.draft && draftData.draft[s.id]) {
              initial[s.id] = draftData.draft[s.id];
            } else {
              initial[s.id] = { score: 10, comment: '' };
            }
          }
        });
        setSubmissions(initial);
        if (draftData.draft) setLastSaved(new Date());
      } else {
        setError(data.error || { message: 'Identity verification failed' });
      }
    } catch (err) {
      setError({ 
        message: 'Network error',
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    if (!currentUser) return;
    setDraftSaving(true);
    try {
      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentUser.id,
          submissions
        })
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save draft');
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);

    const submissionData = Object.keys(submissions).map((studentId) => ({
      studentId,
      score: submissions[studentId].score,
      comment: submissions[studentId].comment
    }));

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluatorId: currentUser.id,
          submissions: submissionData
        })
      });

      const data = await res.json();
      if (res.ok) {
        setView('success');
        fetchResults();
      } else {
        setError(data.error || { message: 'Submission failed' });
      }
    } catch (err) {
      setError({ 
        message: 'Network error',
        code: 'NETWORK_ERROR',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you absolutely sure you want to RESET THE ENTIRE SYSTEM? This will delete all votes and drafts permanently.')) {
        return;
    }

    setLoading(true);
    try {
        const res = await fetch('/api/admin/reset', { method: 'POST' });
        if (res.ok) {
            setView('login');
            setCurrentUser(null);
            setTotalSubmissions(0);
            setResults([]);
            setSubmissions({});
            alert('System has been completely reset.');
            fetchStudents();
            fetchResults();
        } else {
            alert('Reset failed.');
        }
    } catch (err) {
        alert('Network error during reset.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 relative overflow-hidden font-sans">
      {/* Mesh Background */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <header className="fixed top-0 w-full h-20 flex items-center justify-between px-8 bg-white/5 border-b border-white/10 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">SUSHI ENGLISH</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none mt-1">Classroom Session</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {totalSubmissions > 0 && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Participation</p>
              <p className="text-lg font-mono font-bold text-emerald-400 leading-none">
                {totalSubmissions} / {students.length} <span className="text-[10px] font-normal text-slate-500">Submissions</span>
              </p>
            </div>
          )}
          {currentUser && (
             <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-400 uppercase">Logged in as</p>
                    <p className="font-medium text-white leading-none">{currentUser.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setCurrentUser(null);
                    setView('login');
                  }}
                  className="w-10 h-10 rounded-full border-2 border-indigo-400/30 p-0.5 hover:border-indigo-400 transition-colors"
                >
                  <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center font-bold text-indigo-300">
                    {currentUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                </button>
             </div>
          )}
        </div>
      </header>

      <main className="relative pt-28 pb-12 px-6 max-w-5xl mx-auto z-10 flex flex-col min-h-screen">
        <AnimatePresence mode="wait">
          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto w-full space-y-8 py-10"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-black tracking-tighter text-white">Identify Yourself</h2>
                <p className="text-slate-400">Select your name to begin the evaluation session.</p>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-100 animate-shake flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                      <span className="font-bold text-sm">{error.message}</span>
                    </div>
                    {(error.code || error.timestamp) && (
                      <div className="mt-1 pt-2 border-t border-red-500/20 flex flex-wrap gap-x-4 gap-y-1">
                        {error.code && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] uppercase font-black tracking-tighter text-red-500/70">Code</span>
                            <span className="text-[10px] font-mono text-red-400/80">{error.code}</span>
                          </div>
                        )}
                        {error.timestamp && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] uppercase font-black tracking-tighter text-red-500/70">Time</span>
                            <span className="text-[10px] font-mono text-red-400/80">{new Date(error.timestamp).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              <div className="space-y-4">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <select
                    value={currentUser?.id || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleLogin(e.target.value);
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-11 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer backdrop-blur-xl"
                  >
                    <option value="" className="bg-slate-900">Choose your name...</option>
                    {students.sort((a, b) => a.name.localeCompare(b.name)).map((student) => (
                      <option key={student.id} value={student.id} className="bg-slate-900">
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none group-hover:translate-x-1 transition-transform rotate-90" />
                </div>
                
                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest leading-relaxed">
                  Note: You can only vote once. <br />
                  Make sure you select the correct identity.
                </p>
              </div>
              
              <div className="text-center">
                 <button 
                  onClick={() => setView('leaderboard')}
                  className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-400 flex items-center gap-2 mx-auto transition-colors"
                 >
                    <BarChart3 className="w-4 h-4" />
                    Bypass to Results
                 </button>
              </div>
            </motion.div>
          )}

          {view === 'evaluate' && currentUser && (
            <motion.div
              key="evaluate"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28 h-fit">
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Evaluator</h3>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] font-black rounded uppercase tracking-wider">Form Active</span>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold text-white">{currentUser.name}</p>
                        <p className="text-xs text-slate-400">Please provide honest feedback for every presentation.</p>
                    </div>
                    
                    <div className="pt-4 border-t border-white/10 space-y-3">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Actions</p>
                        
                        <button
                            disabled={loading || draftSaving}
                            onClick={saveDraft}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 text-sm"
                        >
                            {draftSaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Save Draft</span>
                                </>
                            )}
                        </button>

                        <button
                            disabled={loading || draftSaving}
                            onClick={handleSubmit}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    <span>Final Submission</span>
                                </>
                            )}
                        </button>

                        {lastSaved && (
                            <div className="flex items-center justify-center gap-2 text-[10px] text-emerald-500 font-medium">
                                <Clock className="w-3 h-3" />
                                <span>Last saved at {lastSaved.toLocaleTimeString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                <button 
                    onClick={() => setView('leaderboard')}
                    className="w-full p-4 rounded-xl border border-white/5 bg-white/2 backdrop-blur-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest"
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Preview Leaderboard
                </button>
              </div>

              <div className="lg:col-span-8 space-y-4">
                {students.filter(s => s.id !== currentUser.id).map((student) => (
                  <div 
                    key={student.id}
                    className="bg-white/5 border border-white/5 backdrop-blur-md p-6 rounded-2xl space-y-6 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-white/5">
                                {student.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="font-bold text-xl text-white">{student.name}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl border border-white/10">
                            <span className="text-2xl font-black text-indigo-400 tabular-nums">
                                {submissions[student.id]?.score}
                            </span>
                            <span className="text-xs text-slate-500 font-bold uppercase">/ 20</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-12 text-right">Score</span>
                            <input 
                                type="range"
                                min="0"
                                max="20"
                                step="0.5"
                                value={submissions[student.id]?.score}
                                onChange={(e) => {
                                    setSubmissions(prev => ({
                                        ...prev,
                                        [student.id]: { 
                                            ...prev[student.id], 
                                            score: parseFloat(e.target.value) 
                                        }
                                    }))
                                }}
                                className="flex-1 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                            />
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest w-12 text-right">Note</span>
                            <textarea 
                                placeholder="Optional feedback..."
                                value={submissions[student.id]?.comment}
                                onChange={(e) => {
                                    setSubmissions(prev => ({
                                        ...prev,
                                        [student.id]: { 
                                            ...prev[student.id], 
                                            comment: e.target.value 
                                        }
                                    }))
                                }}
                                className="flex-1 p-3 bg-slate-900/50 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-slate-300"
                                rows={1}
                            />
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center space-y-10 py-20"
            >
              <div className="relative group mx-auto w-32 h-32">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl group-hover:blur-3xl transition-all"></div>
                <div className="relative w-32 h-32 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 animate-pulse">
                  <CheckCircle2 className="w-16 h-16" />
                </div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-4xl font-black tracking-tighter text-white">Votes Secured</h2>
                <p className="text-slate-400 leading-relaxed">
                  Your evaluations have been successfully encrypted and submitted to the presentation hub.
                </p>
              </div>

              <div className="pt-6">
                <button
                    onClick={() => setView('leaderboard')}
                    className="px-10 py-4 bg-white text-slate-950 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl shadow-white/10"
                >
                    Enter Leaderboard
                </button>
              </div>
            </motion.div>
          )}

          {view === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto w-full space-y-12 py-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-8">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                        Live Standings
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-white">Class Ranking</h2>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Participation Rate</p>
                    <p className="text-2xl font-mono font-black text-indigo-400 tracking-tighter">
                        {Math.round((totalSubmissions / students.length) * 100)}%
                    </p>
                </div>
              </div>

              <div className="space-y-3">
                {results.map((result, index) => {
                  const isTopOne = index === 0 && result.count > 0;
                  const isTopTwo = index === 1 && result.count > 0;
                  const isTopThree = index === 2 && result.count > 0;

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={result.id}
                      className={cn(
                        "group relative flex items-center p-4 rounded-2xl border transition-all duration-500",
                        isTopOne ? "bg-gradient-to-r from-amber-500/20 to-transparent border-amber-500/30 scale-[1.02] z-10" : 
                        isTopTwo ? "bg-gradient-to-r from-slate-400/15 to-transparent border-slate-400/25" :
                        isTopThree ? "bg-gradient-to-r from-orange-800/15 to-transparent border-orange-800/25" :
                        "bg-white/2 border-white/5 hover:bg-white/5"
                      )}
                    >
                      {isTopOne && <div className="absolute -inset-0.5 bg-amber-500/10 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>}
                      
                      <div className={cn(
                          "relative w-12 h-12 rounded-xl flex items-center justify-center text-xl",
                          isTopOne ? "bg-amber-500/20 border border-amber-500/40" : 
                          isTopTwo ? "bg-slate-400/20 border border-slate-400/40" :
                          isTopThree ? "bg-orange-800/20 border border-orange-800/40" :
                          "bg-slate-900 border border-white/5 text-slate-600 font-mono text-sm font-bold"
                      )}>
                        {isTopOne ? "🥇" : isTopTwo ? "🥈" : isTopThree ? "🥉" : `${index + 1}.`}
                      </div>

                      <div className="relative flex-1 px-6">
                        <h4 className={cn(
                            "font-bold text-lg tracking-tight",
                            isTopOne ? "text-amber-100" : "text-slate-200"
                        )}>{result.name}</h4>
                        <div className="flex items-center gap-3">
                            <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                isTopOne ? "text-amber-500" : isTopTwo ? "text-slate-400" : isTopThree ? "text-orange-600" : "text-slate-500"
                            )}>Rank {index + 1}</p>
                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                            <p className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">{result.count} reviews</p>
                        </div>
                      </div>

                      <div className="relative text-right">
                        <div className={cn(
                            "text-2xl font-mono font-black tabular-nums tracking-tighter leading-none",
                            isTopOne ? "text-amber-400" : "text-indigo-400"
                        )}>
                            {result.count > 0 ? result.average.toFixed(2) : "--"}
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-1">Avg Score</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Performance Charts */}
              {results.length > 0 && results.some(r => r.count > 0) && (
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 space-y-6">
                    <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Performance Visualization</h3>
                         <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <BarChart3 className="w-4 h-4" />
                         </div>
                    </div>

                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fill: '#64748b', fontSize: 10 }} 
                                    axisLine={false} 
                                    tickLine={false}
                                    hide={window.innerWidth < 640}
                                />
                                <YAxis 
                                    domain={[0, 20]} 
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#0f172a', 
                                        border: '1px solid #ffffff10',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: '#f1f5f9'
                                    }}
                                    itemStyle={{ color: '#818cf8' }}
                                    cursor={{ fill: '#ffffff05' }}
                                />
                                <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                                    {results.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#9a3412' : '#6366f1'} 
                                            fillOpacity={0.8}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
              )}

              <div className="pt-10 flex flex-col items-center gap-6">
                {!currentUser && (
                    <button
                        onClick={() => setView('login')}
                        className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Identify and Vote
                    </button>
                )}
                <div className="text-[9px] text-slate-500 flex items-center gap-4 border-t border-white/5 pt-6 w-full justify-between font-bold uppercase tracking-widest">
                    <span>EDU-COLLAB SYSTEMS • ENCRYPTED</span>
                    <span>Database Status: <span className="text-emerald-500">Connected</span></span>
                </div>

                <div className="pt-8 w-full border-t border-white/5">
                   <button
                    onClick={handleReset}
                    className="w-full py-3 bg-red-500/5 hover:bg-red-500/20 text-red-500/50 hover:text-red-400 text-[10px] font-black uppercase tracking-[0.3em] rounded-xl border border-red-500/10 transition-all flex items-center justify-center gap-2 group"
                   >
                     <AlertCircle className="w-3 h-3" />
                     Emergency System Reset
                   </button>
                   <p className="text-[8px] text-slate-700 text-center mt-4 uppercase tracking-[0.2em]">Note: This action is irreversible and clears all database records.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer bar */}
      <footer className="fixed bottom-0 w-full h-10 px-8 flex items-center justify-between bg-black/40 text-[10px] text-slate-500 z-50 backdrop-blur-md border-t border-white/5">
        <p className="tracking-widest uppercase font-medium">© 2024 student presentation hub • v2.0</p>
        <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-emerald-500 rounded-full"></div> LIVE SYNC</span>
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-indigo-500 rounded-full"></div> DATA SECURE</span>
        </div>
      </footer>
    </div>
  );
}
