/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useSearchParams, 
  useNavigate 
} from "react-router-dom";
import { 
  Briefcase, 
  Search, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ChevronRight,
  Building2,
  Trophy,
  Target,
  LogOut,
  User as UserIcon,
  Upload,
  FileIcon,
  Image as ImageIcon,
  Mic,
  MessageSquare,
  Zap,
  Waves,
  Play,
  Square,
  FileDown,
  Loader2,
  X,
  RefreshCw,
  Linkedin,
  Link2,
  Shield,
  ExternalLink,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  History,
  Lock
} from "lucide-react";
import { cn } from "./lib/utils";
import { 
  analyzeResume, 
  generateCoverLetter, 
  generateInterviewFeedback, 
  getNegotiationAdvice,
  analyzeProfiles,
  auditStory,
  autoInjectKeywords,
  type AnalysisResult 
} from "./services/geminiService";
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, type FirebaseUser } from "./lib/firebase";
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  setDoc, 
  getDoc,
  doc, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy,
  deleteDoc
} from "firebase/firestore";
import * as mammoth from "mammoth";
import { jsPDF } from "jspdf";
import confetti from "canvas-confetti";
import { Toaster, toast } from "sonner";
import { useLinkedInAuth } from "./hooks/useLinkedInAuth";

type Tab = "optimize" | "skills" | "jobs" | "interview" | "profile" | "recruiter" | "applications";

interface InterviewFeedback {
  transcript?: string;
  confidenceScore: number;
  confidenceAnalysis: string;
  clarity: string;
  keywords: string;
  starStructure: boolean;
  strengths?: string[];
  blindSpots?: string[];
  suggestedAnswer?: string;
  overall: string;
}

interface ProjectStory {
  id: string;
  title: string;
  content: string;
  audit?: {
    summary: string;
    hasResult: boolean;
    suggestion: string;
  };
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const Logo = ({ className }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <svg 
      viewBox="0 0 100 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className="w-full h-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]"
    >
      <defs>
        <linearGradient id="velaa-interlock-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#0072FF" />
        </linearGradient>
        <filter id="3d-sheen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur"/>
          <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1" specularExponent="20" lightingColor="white" result="specOut">
            <fePointLight x="-50" y="-100" z="200"/>
          </feSpecularLighting>
          <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut"/>
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litGraphic"/>
        </filter>
      </defs>
      <g filter="url(#3d-sheen)">
        <path 
          d="M65 30 C65 38.2843 58.2843 45 50 45 C41.7157 45 35 38.2843 35 30 C35 21.7157 41.7157 15 50 15 C58.2843 15 65 21.7157 65 30" 
          stroke="url(#velaa-interlock-grad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
        />
        <path 
          d="M30 15 C38.2843 15 45 21.7157 45 30 C45 34 43.5 37.5 41 40" 
          stroke="url(#velaa-interlock-grad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
        />
        <path 
          d="M35 43 C33.5 44 31.8 45 30 45 C21.7157 45 15 38.2843 15 30 C15 21.7157 21.7157 15 30 15" 
          stroke="url(#velaa-interlock-grad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
        />
      </g>
    </svg>
  </div>
);

export default function App() {
  // 1. NUCLEAR URL CHECK: Just look at the raw string.
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isCallback = currentUrl.includes('code=');

  // 2. THE INLINE INTERCEPTOR
  if (isCallback) {
    const urlObj = new URL(currentUrl);
    const code = urlObj.searchParams.get('code');

    const SyncHandler = () => {
      const [msg, setMsg] = useState('Hijack successful. Exchanging code...');
      
      useEffect(() => {
        if (!code) return;
        (async () => {
          try {
            const res = await fetch('/api/linkedin/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            
            if (!res.ok) throw new Error('Backend failed');
            const profile = await res.json();
            
            setMsg('Success! Saving to storage...');
            localStorage.setItem('linkedin_profile', JSON.stringify(profile));
            localStorage.setItem('linkedin_oauth_success', JSON.stringify({ profile, ts: Date.now() }));
            
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'LINKEDIN_OAUTH_RESULT', profile }, '*');
            }
            
            setMsg('Done! Closing window...');
            setTimeout(() => window.close(), 1000);
          } catch (err: any) {
            setMsg('Error: ' + err.message);
          }
        })();
      }, []);

      return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0f172a', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <h2>{msg}</h2>
        </div>
      );
    };

    return <SyncHandler />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<VelaaDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors theme="dark" />
    </Router>
  );
}

function VelaaDashboard() {
  const { profile: linkedInProfile, status: authStatus, error: authError, login: loginLinkedIn, logout: logoutLinkedIn } = useLinkedInAuth();
  
  const [activeTab, setActiveTab] = useState<Tab>("optimize");
  const [resumeText, setResumeText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [companyKeywords, setCompanyKeywords] = useState<Record<string, string[]>>({});
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skillsCleanupDoneRef = useRef<string | null>(null);

  const [liveJobs, setLiveJobs] = useState<any[]>([]);
  const [isFetchingJobs, setIsFetchingJobs] = useState(false);

  const fetchLiveJobs = async (role = "software engineer") => {
  setIsFetchingJobs(true);
  try {
    const res = await fetch(`/api/jobs?role=${encodeURIComponent(role)}&location=india`);
    const data = await res.json();
    setLiveJobs(data);
  } catch (err) {
    console.error("Failed to fetch jobs", err);
  } finally {
    setIsFetchingJobs(false);
  }
};
  // New features state
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [isGeneratingCL, setIsGeneratingCL] = useState(false);
  const [selectedInterviewQuestion, setSelectedInterviewQuestion] = useState<number>(0);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [isAnalyzingInterview, setIsAnalyzingInterview] = useState(false);
  const [interviewFeedback, setInterviewFeedback] = useState<InterviewFeedback | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [negotiationChat, setNegotiationChat] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
  const [negotiationQuery, setNegotiationQuery] = useState("");
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [showNegotiationCoach, setShowNegotiationCoach] = useState(false);

  // Profile Sync state
  const [syncedProfiles, setSyncedProfiles] = useState<{ linkedin: any, naukri: any }>({ linkedin: null, naukri: null });
  const [profileAnalysis, setProfileAnalysis] = useState<{ inconsistencies: string[], unifiedIdentity: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<'linkedin' | 'naukri' | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const fetchSyncedProfile = async () => {
    if (linkedInProfile) {
      setSyncedProfiles(prev => ({ 
        ...prev, 
        linkedin: { 
          name: linkedInProfile.name, 
          email: linkedInProfile.email, 
          picture: linkedInProfile.picture,
          skills: ['React', 'TypeScript', 'Node.js', 'Python'],
          lastUpdate: new Date().toISOString().split('T')[0]
        } 
      }));
    }
  };

  useEffect(() => {
    fetchSyncedProfile();
  }, [linkedInProfile]);

  useEffect(() => {
    if (linkedInProfile && resumeText) {
      analyzeProfiles(
        resumeText,
        JSON.stringify(linkedInProfile),
        syncedProfiles.naukri ? JSON.stringify(syncedProfiles.naukri) : ""
      ).then(analysis => setProfileAnalysis(analysis))
       .catch(e => console.error("Profile analysis failed", e));
    }
  }, [linkedInProfile, resumeText, syncedProfiles.naukri]);

  // Connection management
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'failed'| 'offline'>('connected');
  const [retryCount, setRetryCount] = useState(0);

  const simulateReconnect = useCallback(() => {
    if (connectionStatus === 'connected') return;
    
    const backoff = Math.min(Math.pow(2, retryCount) * 1000, 10000);
    setTimeout(() => {
      setConnectionStatus('connected');
      setRetryCount(0);
    }, backoff);
  }, [connectionStatus, retryCount]);

  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      simulateReconnect();
    }
  }, [connectionStatus, simulateReconnect]);

  // Roadmap & Progress state
  const [userProgress, setUserProgress] = useState({
    resumeAnalyzed: false,
    profilesSynced: false,
    interviewPracticed: false,
    applicationSent: false
  });
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showApplyReceipt, setShowApplyReceipt] = useState<{
    company: string;
    role: string;
    id: string;
    timestamp: string;
  } | null>(null);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [userRole, setUserRole] = useState<'candidate' | 'recruiter'>('candidate');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [recruiterFilters, setRecruiterFilters] = useState({ location: "", skill: "" });

  useEffect(() => {
    if (user) {
      const completion = calculateCompletion(userProgress);
      setDoc(doc(db, "users", user.uid), { 
        roadmapCompletion: completion,
        applicationSent: userProgress.applicationSent,
        resumeAnalyzed: userProgress.resumeAnalyzed,
        profilesSynced: userProgress.profilesSynced,
        interviewPracticed: userProgress.interviewPracticed
      }, { merge: true }).catch(err => console.error("Progress update failed", err));
    }
  }, [userProgress, user]);

  useEffect(() => {
    if (result) setUserProgress(prev => ({ ...prev, resumeAnalyzed: true }));
    if (syncedProfiles.linkedin || syncedProfiles.naukri) setUserProgress(prev => ({ ...prev, profilesSynced: true }));
    if (interviewFeedback) setUserProgress(prev => ({ ...prev, interviewPracticed: true }));
  }, [result, syncedProfiles, interviewFeedback]);

  const calculateCompletion = (progress: typeof userProgress) => {
    let count = 0;
    if (progress.resumeAnalyzed) count += 25;
    if (progress.profilesSynced) count += 25;
    if (progress.interviewPracticed) count += 25;
    if (progress.applicationSent) count += 25;
    return count;
  };

  useEffect(() => {
    if (user) {
      // Check user role...
      getDocs(query(collection(db, "users"), where("uid", "==", user.uid))).then(snap => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setUserRole(data.role || 'candidate');
        }
      });
      
      // Fetch applications
      getDocs(query(collection(db, "applications"), where("userId", "==", user.uid))).then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        setMyApplications(list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      });

      // One-time cleanup: remove invalid entries from skills array
      if (skillsCleanupDoneRef.current !== user.uid) {
        (async () => {
          try {
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) return;

            const skills = Array.isArray(snap.data().skills) ? snap.data().skills : [];
            const cleanedSkills = skills.filter(
              (s: unknown) =>
                typeof s === "string" &&
                s.length <= 50 &&
                !s.toLowerCase().includes("missing")
            );

            if (
              cleanedSkills.length !== skills.length ||
              cleanedSkills.some((s: string, i: number) => s !== skills[i])
            ) {
              await setDoc(userRef, { skills: cleanedSkills }, { merge: true });
            }
            skillsCleanupDoneRef.current = user.uid;
          } catch (err) {
            console.error("Skills cleanup failed", err);
          }
        })();
      }
    }
  }, [user]);

  const fetchCandidates = async () => {
    if (userRole !== 'recruiter') return;
    setIsLoadingCandidates(true);
    try {
      const q = query(
        collection(db, "users"), 
        where("roadmapCompletion", "==", 100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data());
      setCandidates(list);
    } catch (err) {
      console.error("Fetch candidates failed", err);
      toast.error("Failed to fetch top candidates.");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleRequestInterview = async (candidateId: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "interview_requests"), {
        requesterId: user.uid,
        candidateId,
        message: `A recruiter from Velaa's partner network wants to interview you!`,
        timestamp: serverTimestamp(),
        status: "pending"
      });
      toast.success("INTERVIEW REQUEST SENT", {
        description: "Candidate will be notified in their terminal.",
      });
    } catch (err) {
      console.error("Request failed", err);
    }
  };

  const handleAutoInjectKeywords = async () => {
    if (!result?.missingSkills || result.missingSkills.length === 0) {
      toast.info("No missing skills identified to inject.");
      return;
    }
    setIsInjecting(true);
    try {
      const injection = await autoInjectKeywords(resumeText, result.missingSkills);
      setResumeText(injection.fullImprovedResume);
      setResult(prev => prev ? { ...prev, improvedResume: injection.fullImprovedResume } : null);
      triggerSuccess("Keywords injected into Summary and Skills.");
    } catch (err) {
      console.error("Injection failed", err);
      toast.error("AI keyword injection failed.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const queryStr = formData.get("query") as string;
    if (!queryStr) return;
    if (!user) {
      toast.error("Please sign in to save your progress");
      return;
    }

    try {
      await addDoc(collection(db, "support_tickets"), {
        userId: user.uid,
        userEmail: user.email || "",
        query: queryStr,
        timestamp: serverTimestamp(),
        status: "open"
      });
      alert("Support query submitted successfully!");
      setShowSupport(false);
    } catch (err) {
      console.error("Support submission failed", err);
    }
  };

  const handlePurgeData = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to permanently delete ALL your data from Velaa? This includes resumes, analysis, scores and project stories. This cannot be undone.")) return;

    try {
      const q = query(collection(db, "analyses"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      
      await deleteDoc(doc(db, "users", user.uid));
      
      alert("Data purged successfully. You will be logged out.");
      handleLogout();
    } catch (err) {
      console.error("Purge failed", err);
    }
  };

  // Story Vault state
  const [stories, setStories] = useState<ProjectStory[]>([
    { id: '1', title: 'Top Project A', content: '' },
    { id: '2', title: 'Internship Achievement', content: '' },
    { id: '3', title: 'Problem Solving Story', content: '' }
  ]);
  const [isAuditingStory, setIsAuditingStory] = useState<string | null>(null);

  // Audio Recording states/refs
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<{ data: string; mimeType: string } | null>(null);
  const [isRecordingReal, setIsRecordingReal] = useState(false);

  useEffect(() => {
    fetch("/api/keywords")
      .then(res => res.json())
      .then(data => setCompanyKeywords(data))
      .catch(err => console.error("Failed to fetch keywords", err));

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        (async () => {
          try {
            const userRef = doc(db, "users", u.uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              await setDoc(userRef, {
                uid: u.uid,
                email: u.email,
                displayName: u.displayName,
                photoURL: u.photoURL,
                role: "candidate",
                plan: "free",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              await setDoc(
                userRef,
                {
                  displayName: u.displayName,
                  photoURL: u.photoURL,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`);
          }
        })();
      }
    });
    return () => unsubscribe();
  }, []);

  // Automatic analysis trigger
  useEffect(() => {
    const shouldTrigger = 
      uploadedFile && 
      targetRole.trim().length >= 2 && 
      targetCompany.trim().length >= 2 && 
      !isAnalyzing && 
      !result;

    if (shouldTrigger) {
      handleFileUpload(uploadedFile);
    }
  }, [uploadedFile, targetRole, targetCompany, isAnalyzing, result]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.log('Login error:', error);
      toast.error('Sign in failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    if (!targetRole.trim() || !targetCompany.trim()) return; 
    
    setIsAnalyzing(true);
    setAnalysisStep("Reading Resume...");
    
    try {
      const mimeType = file.type;
      const reader = new FileReader();

      const runAnalysis = async (resumeData: string | { data: string; mimeType: string }) => {
        setAnalysisStep(`Researching ${targetCompany} Hiring Trends...`);
        
        // Checking Cache
        let cachedData = null;
        try {
          const q = query(
            collection(db, "company_insights"),
            where("companyName", "==", targetCompany.toLowerCase().trim()),
            orderBy("updatedAt", "desc"),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const age = Date.now() - (data.updatedAt?.toMillis() || 0);
            if (age < 24 * 60 * 60 * 1000) {
              cachedData = data;
              console.log("Using cached company insights");
            }
          }
        } catch (e) {
          console.warn("Cache check failed", e);
        }

        // Parallel hint: We send cached data if available to speed up or refine
        const syncedStr = (syncedProfiles.linkedin || syncedProfiles.naukri) 
          ? JSON.stringify({ linkedin: syncedProfiles.linkedin, naukri: syncedProfiles.naukri }) 
          : undefined;

        const analysis = await analyzeResume(
          resumeData, 
          targetCompany, 
          targetRole,
          cachedData ? { culture: cachedData.culture, trends: cachedData.trends } : undefined,
          syncedStr
        );

        setAnalysisStep("Calculating ATS Match Score...");
        
        // Store in cache if new
        if (!cachedData && analysis.culture && analysis.trends) {
          try {
            await addDoc(collection(db, "company_insights"), {
              companyName: targetCompany.toLowerCase().trim(),
              culture: analysis.culture,
              trends: analysis.trends,
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.warn("Failed to cache insights", e);
          }
        }

        finalizeAnalysis(analysis, typeof resumeData === 'string' ? resumeData : (analysis.extractedText || "Extracted"));
      };
      
      if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const { value: text } = await mammoth.extractRawText({ arrayBuffer });
          setResumeText(text);
          await runAnalysis(text);
        };
        reader.readAsArrayBuffer(file);
      } else if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
        reader.onload = async (e) => {
          const resultStr = e.target?.result as string;
          const base64Data = resultStr.split(",")[1];
          await runAnalysis({ data: base64Data, mimeType });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = async (e) => {
          const text = e.target?.result as string;
          setResumeText(text);
          await runAnalysis(text);
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error("Failed to process file", error);
      setIsAnalyzing(false);
      setAnalysisStep("");
    }
  };

  const handleApplyToJob = async () => {
    if (!user) {
      toast.error("Please sign in to save your progress");
      return;
    }

    const trackerId = `VL-2026-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    const appData = {
      trackingId: trackerId,
      company: targetCompany || "Elite Partner",
      role: targetRole || "Fresh Graduate Role",
      status: "Submitted",
      appliedAt: timestamp,
      resumeVersion: "Velaa-Optimized-V2.pdf",
      platform: "LinkedIn API Sync",
      userId: user.uid
    };

    setUserProgress(prev => ({ ...prev, applicationSent: true }));
    
    // Store locally for UI
    setMyApplications(prev => [appData, ...prev]);
    
    try {
      await addDoc(collection(db, "applications"), {
        ...appData,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to persist application", err);
    }

    setShowApplyReceipt({
      company: appData.company,
      role: appData.role,
      id: trackerId,
      timestamp: timestamp
    });

    toast.success(`Application transmitted to ${appData.company} HR Portal`, {
      description: "Official Receipt generated and stored in dashboard.",
      duration: 5000,
    });
    
    setShowRoadmap(true);
  };

  const handleExportPDF = () => {
    const textToExport = result?.improvedResume || resumeText;
    if (!textToExport) {
      toast.error("Process resume first to export.");
      return;
    }
    
    try {
      const doc = new jsPDF();
      // ATS Layout: Standard fonts, simple markers
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text("PROFESSIONAL RESUME", 20, 20);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 25, 190, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const splitText = doc.splitTextToSize(textToExport, pageWidth - (margin * 2));
      
      let y = 35;
      const lineHeight = 6;
      
      splitText.forEach((line: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
      
      doc.save(`${targetCompany || 'Velaa'}_ATS_Resume.pdf`);
      
      triggerSuccess("ATS-FRIENDLY RESUME EXPORTED");
    } catch (err) {
      console.error("PDF Export failed", err);
      toast.error("Export failed. Please try again.");
    }
  };

  const finalizeAnalysis = async (analysis: AnalysisResult, text: string) => {
    setResult(analysis);
    setIsAnalyzing(false);
    setAnalysisStep("");
    triggerSuccess("Resume DNA mapped and optimized.");
    
    if (!user) {
      toast.error("Please sign in to save your progress");
      return;
    }

    const path = "analyses";
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        resumeText: text,
        targetCompany,
        atsScore: analysis.atsScore,
        missingSkills: analysis.missingSkills,
        matchedJobs: analysis.matchedJobs,
        tips: analysis.tips,
        salaryIntelligence: analysis.salaryIntelligence || null,
        interviewQuestions: analysis.interviewQuestions || [],
        culture: analysis.culture || "",
        trends: analysis.trends || "",
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleAutoDraftCL = React.useCallback(async (specificRole?: string) => {
    const roleToDraft = specificRole || targetRole;
    console.log("handleAutoDraftCL called", { resumeText: !!resumeText, targetCompany, roleToDraft });
    
    if (!resumeText || !targetCompany || !roleToDraft) {
      console.warn("Insufficient data for drafting application");
      return;
    }
    
    setIsGeneratingCL(true);
    try {
      const cl = await generateCoverLetter(resumeText, targetCompany, roleToDraft);
      setCoverLetter(cl);
    } catch (error) {
      console.error("Cover Letter error:", error);
    } finally {
      setIsGeneratingCL(false);
    }
  }, [resumeText, targetCompany, targetRole]);

  // Export to window for debugging and to satisfy external session needs
  useEffect(() => {
    (window as any).handleAutoDraft = handleAutoDraftCL;
    return () => {
      delete (window as any).handleAutoDraft;
    };
  }, [handleAutoDraftCL]);

  const handleProfileSync = async (platform: 'linkedin' | 'naukri') => {
    if (platform === 'linkedin') {
      try {
        // Use AbortController for a custom timeout as fetch doesn't have one
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch("/api/auth/linkedin/url", { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error("Failed to get auth URL");
        const { url } = await res.json();
        
        // Open in new tab with the corrected absolute redirect_uri
        const absoluteRedirectUri = `${window.location.origin}/auth/linkedin/callback`;
        const finalUrl = new URL(url);
        finalUrl.searchParams.set('redirect_uri', absoluteRedirectUri);
        
        window.open(finalUrl.toString(), '_blank');
      } catch (err) {
        console.error("LinkedIn Sync Init Failed", err);
        toast.error("Cloud Connection Failed", { description: "Ensure LINKEDIN_CLIENT_ID is set and backend is responsive." });
      }
      return;
    }

    setIsSyncing(platform);
    
    // Simulations of data fetching for other platforms
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const mockData = { 
      skills: ['Java', 'Spring Boot', 'React', 'Cloud'], 
      experience: 'Summer Internship at Zoho',
      lastUpdate: '2026-04-15'
    };
    
    const newProfiles = { ...syncedProfiles, [platform]: mockData };
    setSyncedProfiles(newProfiles);
    setIsSyncing(null);
    
    triggerSuccess(`${platform.toUpperCase()} profile verified and mapped.`);

    // Map skills to resume text if empty
    if (!resumeText) {
      setResumeText(`Skills: ${mockData.skills.join(", ")}\nExperience: ${mockData.experience}`);
    }
  };

  const triggerSuccess = (message: string) => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00D4FF', '#001D3D', '#FFFFFF']
    });
    toast.success("ACHIEVEMENT UNLOCKED", {
      description: message,
    });
  };

  const handleInterviewPractice = async () => {
    if (!result?.interviewQuestions) return;
    
    // Use recorded audio if available, otherwise use text answer
    const answerToPass = recordedAudio || interviewAnswer;
    if (!answerToPass) return;

    // Simulate connection check before sending
    if (connectionStatus !== 'connected') {
      console.warn("Attempting to send audio data on unstable connection...");
      setConnectionStatus('reconnecting');
      return;
    }

    setIsAnalyzingInterview(true);
    try {
      const feedback = await generateInterviewFeedback(
        result.interviewQuestions[selectedInterviewQuestion],
        answerToPass
      );
      setInterviewFeedback(feedback);
      triggerSuccess("Velaa AI has evaluated your response for STAR standards.");
    } catch (e: any) {
      console.error("Interview Practice error", e);
      // Trigger exponential backoff UI if a network error occurs
      if (e.message?.includes('network') || e.message?.includes('socket') || e.message?.includes('Fetch')) {
        setConnectionStatus('reconnecting');
        setRetryCount(prev => prev + 1);
      }
    } finally {
      setIsAnalyzingInterview(false);
    }
  };

  const handleAuditStory = async (storyId: string) => {
    const story = stories.find(s => s.id === storyId);
    if (!story || !story.content.trim()) return;
    
    setIsAuditingStory(storyId);
    try {
      const result = await auditStory(story.content);
      setStories(prev => prev.map(s => s.id === storyId ? {
        ...s,
        audit: {
          summary: result.audit,
          hasResult: result.hasResult,
          suggestion: result.suggestion
        }
      } : s));
    } catch (e) {
      console.error("Audit story error", e);
    } finally {
      setIsAuditingStory(null);
    }
  };

  const handleStoryUpdate = (id: string, content: string) => {
    setStories(prev => prev.map(s => s.id === id ? { ...s, content } : s));
  };

  const handleNegotiationSubmit = async () => {
    if (!negotiationQuery.trim()) return;
    const userMsg = { role: 'user' as const, text: negotiationQuery };
    setNegotiationChat(prev => [...prev, userMsg]);
    setNegotiationQuery("");
    setIsNegotiating(true);
    
    const advice = await getNegotiationAdvice(negotiationQuery);
    setNegotiationChat(prev => [...prev, { role: 'bot' as const, text: advice }]);
    setIsNegotiating(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // STOP RECORDING
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
        mediaRecorder.current.stop();
      }
      setIsRecording(false);
    } else {
      // START RECORDING
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorder.current = recorder;
        audioChunks.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            setRecordedAudio({ data: base64data, mimeType: 'audio/webm' });
          };
          reader.readAsDataURL(audioBlob);
          
          // Stop all tracks in the stream
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setIsRecording(true);
        setInterviewAnswer("(Audio recorded successfully)");
      } catch (err) {
        console.error("Could not start recording", err);
        alert("Microphone access is required for this feature.");
      }
    }
  };

  const handleHardRefresh = () => {
    // Reset all internal working states to "reconnect" modules
    setNegotiationChat([]);
    setInterviewFeedback(null);
    setInterviewAnswer("");
    setCoverLetter(null);
    setResult(null);
    setResumeText("");
    setUploadedFile(null);
    setTargetRole("");
    setTargetCompany("");
    // A small toast or console log to indicate reset
    console.log("Internal app state reset performed.");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setResumeText("");
    setResult(null);
  };

  if (!user && !isLoggingIn) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 text-center font-sans antialiased"
      >
        <motion.div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,229,255,0.12)_0%,_transparent_55%)] pointer-events-none" />
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 flex flex-col items-center max-w-lg w-full"
        >
          <Logo className="h-16 w-auto mb-10" />
          <h1 className="text-4xl md:text-5xl font-black text-offwhite tracking-tight font-display mb-4">
            Your AI Career Agent
          </h1>
          <p className="text-white/60 text-base md:text-lg leading-relaxed mb-10">
            Sign in to save your resume analysis, job applications, and interview progress
          </p>
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center justify-center gap-3 w-full max-w-xs px-6 py-4 bg-white text-navy font-bold rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all shadow-lg shadow-cyan/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
          <p className="mt-8 text-sm text-white/40 max-w-sm">
            Your data is private and never shared
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite text-navy font-sans antialiased">
      {/* Global Sync Overlay */}
      <AnimatePresence>
        {(isSyncing === 'linkedin' || syncSuccess) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-navy/95 backdrop-blur-md flex items-center justify-center p-4 content-center"
          >
            <div className="text-center space-y-6 max-w-sm w-full">
              {syncSuccess ? (
                <div className="space-y-6">
                  <div className="h-20 w-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Sync Successful!</h2>
                    <p className="text-slate-400 font-medium">You can safely close this tab and return to your main dashboard.</p>
                  </div>
                  <button 
                    onClick={() => window.close()}
                    className="w-full py-4 bg-white text-navy font-bold rounded-xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
                  >
                    Close Window
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <div className="h-24 w-24 border-4 border-cyan/20 border-t-cyan rounded-full animate-spin mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Linkedin className="h-10 w-10 text-cyan animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Syncing LinkedIn</h2>
                    <p className="text-cyan font-black text-[10px] tracking-[0.3em] uppercase animate-pulse">Building your professional DNA</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <div className="h-2 w-2 bg-cyan rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 bg-cyan rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 bg-cyan rounded-full animate-bounce"></div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-navy/20">
        <div className="max-w-7xl mx-auto px-4 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-auto aspect-[100/60]" />
            <span className="text-2xl font-black tracking-tight font-display text-offwhite">Velaa Intelligence</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => setActiveTab("optimize")}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === "optimize" ? "text-cyan" : "text-white/60 hover:text-white")}
            >
              Optimizer
            </button>
            <button 
              onClick={() => setActiveTab("jobs")}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === "jobs" ? "text-cyan" : "text-white/60 hover:text-white")}
            >
              Job Matcher
            </button>
            <button 
              onClick={() => setActiveTab("applications")}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === "applications" ? "text-cyan" : "text-white/60 hover:text-white")}
            >
              My Applications
            </button>
            {userRole === 'recruiter' && (
              <button 
                onClick={() => { setActiveTab("recruiter"); fetchCandidates(); }}
                className={cn("text-xs uppercase tracking-widest font-bold transition-all flex items-center gap-2", activeTab === "recruiter" ? "text-cyan" : "text-white/60 hover:text-white")}
              >
                <Briefcase className="w-4 h-4" /> Recruiter Portal
              </button>
            )}
            <button 
              onClick={() => setActiveTab("interview")}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === "interview" ? "text-cyan" : "text-white/60 hover:text-white")}
            >
              Interview Prep
            </button>
            <button 
              onClick={() => setActiveTab("profile")}
              className={cn("text-xs uppercase tracking-widest font-bold transition-all", activeTab === "profile" ? "text-cyan" : "text-white/60 hover:text-white")}
            >
              Profile Sync
            </button>
          </nav>
          <div className="flex items-center gap-4">
            {/* Connection Status Indicator */}
            <div 
              onClick={() => connectionStatus === 'offline' && window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 shrink-0",
                connectionStatus === 'offline' && "cursor-pointer hover:bg-white/10"
              )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                connectionStatus === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                connectionStatus === 'reconnecting' ? "bg-amber-500 animate-pulse" : "bg-rose-500"
              )} />
              <span className="text-[8px] font-black uppercase text-white/40 hidden sm:inline">
                {connectionStatus === 'connected' ? 'Stable Link' : connectionStatus === 'reconnecting' ? 'Re-establishing' : 'Offline (Click to Refresh)'}
              </span>
            </div>

            {user || linkedInProfile ? (
              <div className="flex items-center gap-3 p-1 pl-3 bg-white/5 border border-white/10 rounded-full">
                <div className="hidden sm:block">
                  <p className="text-[9px] font-black text-cyan uppercase leading-none mb-0.5">{linkedInProfile ? "LIVE API CONNECTED" : "Premium"}</p>
                  <p className="text-xs font-bold text-white leading-tight">
                    {linkedInProfile ? linkedInProfile.name : (user?.displayName?.split(' ')[0] || "User")}
                  </p>
                </div>
                {linkedInProfile?.picture || user?.photoURL ? (
                  <img 
                    src={linkedInProfile?.picture || user?.photoURL} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full border border-white/20 shadow-sm" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center text-cyan">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <button 
                  onClick={() => {
                    handleLogout();
                    logoutLinkedIn();
                  }}
                  className="p-2 text-white/40 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-navy bg-cyan rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan/30"
              >
                {isLoggingIn ? "Signing In..." : "Sign In"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Reconnecting Toast */}
      <AnimatePresence>
        {connectionStatus === 'reconnecting' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 bg-navy border border-cyan/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-l-4 border-l-cyan flex items-center gap-4 min-w-[320px]"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-cyan animate-spin" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">
                WebSocket Handshake Lost
              </p>
              <p className="text-[9px] font-bold text-cyan uppercase tracking-[0.2em] animate-pulse">
                Auto-Reconnect: Attempt {retryCount + 1}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Landing/Hero Section */}
        {!result && (
          <section className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block px-4 py-1.5 mb-6 rounded-full bg-cyan/10 border border-cyan/20 text-cyan text-[10px] font-black uppercase tracking-widest"
            >
              Your AI Career Assistant
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-6xl font-black text-navy mb-6 tracking-tight font-display"
            >
              Get Hired <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-navy via-slate-600 to-cyan">Faster</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Velaa is India's first full-loop AI agent that optimizes your resume, automates your applications, and prepares you for interviews—all in one place. Stop guessing and start landing offers with <span className="text-navy font-bold">2026-grade hiring intelligence.</span>
            </motion.p>
            
            {/* Company Logos */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-30 grayscale hover:grayscale-0 hover:opacity-60 transition-all duration-700"
            >
              {["TCS", "ZOHO", "WIPRO", "INFOSYS", "GOOGLE", "RELIANCE"].map((name) => (
                <span key={name} className="text-sm font-black tracking-[0.2em]">{name}</span>
              ))}
            </motion.div>
          </section>
        )}

        {/* Main Interface */}
        <div className="bg-white rounded-xl shadow-2xl shadow-navy/5 border border-slate-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-50 bg-slate-50/30">
            {[
              { id: "optimize", label: "AI Review", icon: FileText },
              { id: "skills", label: "Tips", icon: Sparkles },
              { id: "jobs", label: "Top Matches", icon: Target },
              { id: "interview", label: "Interview", icon: Mic },
              { id: "profile", label: "Profile Sync", icon: Link2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-5 text-xs font-black uppercase tracking-widest transition-all relative",
                  activeTab === tab.id ? "text-navy" : "text-slate-400 hover:bg-white"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-cyan" : "text-slate-300")} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="active-tab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-cyan"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {activeTab === "optimize" && (
                <motion.div
                  key="optimize"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 font-display uppercase tracking-wider text-[10px]">Target Company</label>
                        <input 
                          type="text"
                          value={targetCompany}
                          onChange={(e) => {
                            setTargetCompany(e.target.value);
                            setResult(null);
                          }}
                          placeholder="e.g. TCS, Zoho, Google..."
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/10 transition-all text-sm font-bold text-navy shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 font-display uppercase tracking-wider text-[10px]">Job Title</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={targetRole}
                            onChange={(e) => {
                              setTargetRole(e.target.value);
                              setResult(null);
                            }}
                            placeholder="e.g. Junior Developer"
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/10 transition-all text-sm font-bold text-navy shadow-sm"
                          />
                          {!uploadedFile && targetRole.length > 2 && (
                            <p className="absolute -bottom-6 left-0 text-[9px] font-black text-cyan uppercase animate-pulse">Now upload your resume to start</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      {isAnalyzing ? (
                        <div className="w-full h-80 bg-offwhite border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-4">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          >
                            <Loader2 className="w-10 h-10 text-cyan" />
                          </motion.div>
                          <p className="text-navy font-bold text-sm">{analysisStep || "Velaa AI Processing..."}</p>
                        </div>
                      ) : (
                        <>
                          {!uploadedFile ? (
                            <div 
                              onDragEnter={handleDrag}
                              onDragLeave={handleDrag}
                              onDragOver={handleDrag}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={cn(
                                "w-full h-80 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-6 cursor-pointer transition-all group",
                                dragActive ? "border-cyan bg-cyan/5" : "border-slate-200 bg-slate-50/30 hover:bg-white hover:border-cyan/50 hover:shadow-xl hover:shadow-cyan/5"
                              )}
                            >
                              <div className="w-20 h-20 bg-offwhite border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-cyan group-hover:scale-110 transition-all shadow-sm">
                                <Upload className="w-8 h-8" />
                              </div>
                              <div className="text-center px-4">
                                <p className="font-bold text-navy text-lg">Initialize Analysis</p>
                                <p className="text-sm text-slate-400 mt-2">PDF, DOCX or High-Res Image of Resume</p>
                              </div>
                              <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                className="hidden" 
                                accept=".pdf,.doc,.docx,image/*"
                              />
                            </div>
                          ) : (
                            <div className="p-8 bg-offwhite rounded-xl border border-slate-200 flex items-center justify-between shadow-inner">
                              <div className="flex items-center gap-5 overflow-hidden">
                                <div className="relative">
                                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-cyan shadow-sm border border-slate-100 flex-shrink-0">
                                    {uploadedFile.type.startsWith('image/') ? <ImageIcon className="w-7 h-7" /> : <FileIcon className="w-7 h-7" />}
                                  </div>
                                  <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 border border-slate-100 shadow-sm"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  </motion.div>
                                </div>
                                <div className="truncate">
                                  <p className="font-black text-navy truncate tracking-tight">{uploadedFile.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase">{uploadedFile.type.split('/')[1] || 'DOC'}</span>
                                    <span className="text-[10px] text-slate-400">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="px-4 py-2 hover:bg-white text-navy font-black text-[10px] uppercase tracking-widest border border-slate-200 rounded-lg transition-all shadow-sm"
                                >
                                  Swap
                                </button>
                                <button 
                                  onClick={clearFile}
                                  className="p-2.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {result && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-10 p-8 bg-navy rounded-xl border border-white/10 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-navy/40"
                      >
                        <div className="flex-shrink-0 relative w-36 h-36 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(0,212,255,0.4)]">
                            <circle
                              cx="72"
                              cy="72"
                              r="64"
                              stroke="currentColor"
                              strokeWidth="10"
                              fill="transparent"
                              className="text-white/5"
                            />
                            <motion.circle
                              initial={{ strokeDasharray: "0 402" }}
                              animate={{ strokeDasharray: `${(result.atsScore / 100) * 402} 402` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              cx="72"
                              cy="72"
                              r="64"
                              stroke="currentColor"
                              strokeWidth="10"
                              strokeLinecap="round"
                              fill="transparent"
                              className="text-cyan"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-white tracking-tighter">{result.atsScore}%</span>
                            <span className="text-[9px] uppercase font-black text-cyan tracking-widest mt-1">Accuracy</span>
                          </div>
                        </div>
                        <div className="text-center md:text-left">
                          <h3 className="text-2xl font-black text-white mb-3 font-display">AI Review Complete</h3>
                          <p className="text-white/60 text-sm leading-relaxed mb-6 font-medium">
                            The Velaa found a <span className="text-cyan font-bold">{result.atsScore}%</span> match with <span className="text-white font-bold">{targetCompany}</span> standards. Head to Tips to see what's missing.
                          </p>

                          {result.salaryIntelligence && (
                            <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                              <h4 className="text-[10px] font-black text-cyan uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> 2026 Salary Intelligence
                              </h4>
                              <p className="text-white font-bold text-lg mb-1">{result.salaryIntelligence.range}</p>
                              <p className="text-white/40 text-[10px] leading-tight italic">{result.salaryIntelligence.locationComparison}</p>
                            </div>
                          )}

                          <div className="flex justify-center md:justify-start gap-4">
                            <button 
                              onClick={() => setActiveTab("skills")}
                              className="px-6 py-3 bg-white/10 hover:bg-white text-white hover:text-navy text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all border border-white/20"
                            >
                              Check Career Tips
                            </button>
                            <button 
                              onClick={handleExportPDF}
                              className="px-6 py-3 bg-cyan text-navy text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:scale-105 transition-all shadow-lg shadow-cyan/20 flex items-center gap-2"
                            >
                              <FileDown className="w-4 h-4" /> Export PDF
                            </button>
                            <button 
                              onClick={handleAutoInjectKeywords}
                              disabled={isInjecting}
                              className="px-6 py-3 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                              {isInjecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              {isInjecting ? "Injecting..." : "Auto-Inject Keywords"}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "skills" && (
                <motion.div
                  key="skills"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-6"
                >
                  {!result ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium">Please analyze your resume first to see skill suggestions.</p>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-cyan" />
                        Strategic Keywords
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {result.missingSkills.map((skill, idx) => (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            key={skill}
                            className="p-6 bg-white border border-slate-100 rounded-xl flex flex-col items-start group hover:border-cyan/30 hover:shadow-xl hover:shadow-cyan/5 transition-all shadow-sm"
                          >
                            <div className="w-10 h-10 bg-offwhite rounded-xl flex items-center justify-center mb-4 text-slate-400 group-hover:text-cyan transition-colors">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                            <span className="font-black text-navy text-lg tracking-tight mb-2 uppercase">{skill}</span>
                            <span className="text-[10px] text-cyan font-black uppercase tracking-widest">Required Vector</span>
                          </motion.div>
                        ))}
                      </div>

                      <div className="p-8 bg-offwhite rounded-xl border border-slate-200">
                        <div className="mb-8">
                          <h4 className="text-[10px] font-black text-navy mb-4 uppercase tracking-[0.2em]">Our Advice</h4>
                          <p className="text-slate-600 italic leading-relaxed text-sm">
                            "{result.tips}"
                          </p>
                        </div>

                        {result.culture && (
                          <div className="pt-8 border-t border-slate-200 mb-8">
                            <h4 className="text-[10px] font-black text-navy mb-4 uppercase tracking-[0.2em]">Institutional DNA</h4>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">{result.culture}</p>
                          </div>
                        )}

                        {result.trends && (
                          <div className="pt-8 border-t border-slate-200 mb-8">
                            <h4 className="text-[10px] font-black text-navy mb-4 uppercase tracking-[0.2em]">Market Velocity 2026</h4>
                            <p className="text-slate-600 text-sm leading-relaxed font-medium">{result.trends}</p>
                          </div>
                        )}

                        {companyKeywords[targetCompany] && (
                          <div className="pt-8 border-t border-slate-200">
                            <h4 className="text-[10px] font-black text-navy mb-4 uppercase tracking-[0.2em]">Standard {targetCompany} Matrix</h4>
                            <div className="flex flex-wrap gap-2">
                              {companyKeywords[targetCompany].map(k => (
                                <span key={k} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-navy uppercase tracking-widest shadow-sm">
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "jobs" && (
                <motion.div
                  key="jobs"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Career Path</h3>
                    <button 
                      onClick={handleHardRefresh}
                      className="text-[9px] font-black uppercase text-cyan hover:text-navy flex items-center gap-1 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" /> Reset Session
                    </button>
                  </div>

                  <div className="space-y-5">
                    {isFetchingJobs ? (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Finding your matches...</p>
  </div>
) : (result?.matchedJobs || liveJobs || []).map((job: any, idx: number) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: idx * 0.05 }}
    key={`${job.title}-${idx}`}
    className="group p-6 bg-white border border-slate-100 rounded-xl hover:border-cyan/30 hover:shadow-2xl hover:shadow-cyan/5 transition-all flex flex-col shadow-sm"
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-offwhite rounded-xl flex items-center justify-center group-hover:bg-navy group-hover:text-cyan transition-all shadow-inner text-slate-400">
          <Building2 className="w-7 h-7" />
        </div>
        <div>
          <h4 className="font-black text-navy uppercase tracking-tight">
            {job.title}
          </h4>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            {job.company?.display_name || "Company"} · {job.location?.display_name || "India"}
          </p>
          {job.salary_min && (
            <p className="text-xs text-cyan font-bold mt-1">
              ₹{Math.round(job.salary_min / 100000)}L – ₹{Math.round((job.salary_max || job.salary_min * 1.5) / 100000)}L
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1 max-w-sm font-medium line-clamp-2">
            {job.description?.slice(0, 120) || ""}...
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-shrink-0">
        {job.matchRate && (
          <div className="text-right mb-1">
            <div className="text-[9px] font-black text-cyan uppercase tracking-widest">Match</div>
            <div className="text-2xl font-black text-navy">{job.matchRate}%</div>
          </div>
        )}
        <button
          onClick={() => handleAutoDraftCL(job.title)}
          disabled={isGeneratingCL}
          className="px-4 py-2 bg-navy text-cyan text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-cyan hover:text-navy transition-all disabled:opacity-50"
        >
          {isGeneratingCL ? "Drafting..." : "Auto-Draft CL"}
        </button>
        <button
          onClick={() => job.redirect_url ? window.open(job.redirect_url, '_blank') : handleApplyToJob()}
          className="px-4 py-2 border border-navy text-navy text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-navy hover:text-white transition-all flex items-center justify-center gap-2"
        >
          Apply Now →
        </button>
      </div>
    </div>

    <AnimatePresence>
      {coverLetter && idx === 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="mt-4 p-6 bg-offwhite rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-[10px] font-black text-navy uppercase tracking-[0.2em] flex items-center gap-2">
                <FileDown className="w-3 h-3" /> Draft Cover Letter
              </h5>
              <button onClick={() => setCoverLetter(null)} className="text-slate-400 hover:text-navy">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium font-serif bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
              {coverLetter}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => window.open(job.redirect_url || 'https://www.linkedin.com/jobs/', '_blank')}
                className="flex-1 py-2.5 bg-navy text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-cyan hover:text-navy transition-all"
              >
                Apply on LinkedIn
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(coverLetter || ''); toast.success('Copied!'); }}
                className="flex-1 py-2.5 border border-navy text-navy text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-navy hover:text-white transition-all"
              >
                Copy Text
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
))}
                  </div>
                </motion.div>
              )}

              {activeTab === "interview" && (
                <motion.div
                  key="interview"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Questions List */}
                    <div className="md:w-1/3 space-y-3">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Question Queue</h3>
                      {(result?.interviewQuestions || [
                        "Tell me about yourself.",
                        "Why do you want to work at TCS?",
                        "What are your technical strengths?",
                        "How do you handle project deadlines?",
                        "Where do you see yourself in 5 years?"
                      ]).map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedInterviewQuestion(idx);
                            setInterviewFeedback(null);
                            setInterviewAnswer("");
                          }}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border transition-all text-xs font-bold leading-relaxed",
                            selectedInterviewQuestion === idx 
                              ? "bg-navy text-white border-navy" 
                              : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          <span className="text-[9px] block opacity-50 mb-1">Question 0{idx + 1}</span>
                          {q}
                        </button>
                      ))}
                    </div>

                    {/* Room */}
                    <div className="md:w-2/3">
                      <div className="aspect-video bg-navy rounded-2xl relative overflow-hidden flex flex-col items-center justify-center p-8 text-center border-4 border-white shadow-2xl">
                        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-navy/80 to-transparent flex items-center justify-between">
                          <p className="text-cyan text-[10px] font-black uppercase tracking-[0.2em]">Velaa AI Interviewer Room</p>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase text-emerald-400">Connection Stable</span>
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {isRecording ? (
                            <motion.div
                              key="recording"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center gap-6"
                            >
                              <div className="flex gap-1 items-center h-8">
                                {[1,2,3,4,5,6].map(i => (
                                  <motion.div
                                    key={i}
                                    animate={{ height: [10, 30, 10] }}
                                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                    className="w-1.5 bg-cyan rounded-full"
                                  />
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-4 w-full px-8">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <div className="text-[8px] font-black uppercase text-cyan mb-2">Voice Clarity</div>
                                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div 
                                      animate={{ width: ["60%", "90%", "75%"] }}
                                      transition={{ repeat: Infinity, duration: 2 }}
                                      className="h-full bg-cyan"
                                    />
                                  </div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                  <div className="text-[8px] font-black uppercase text-purple-400 mb-2">Speaking Pace</div>
                                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div 
                                      animate={{ width: ["40%", "60%", "50%"] }}
                                      transition={{ repeat: Infinity, duration: 2.5 }}
                                      className="h-full bg-purple-400"
                                    />
                                  </div>
                                </div>
                              </div>
                              <p className="text-white font-bold text-lg animate-pulse">Recording Audio...</p>
                              <button 
                                onClick={toggleRecording}
                                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all shadow-lg shadow-red-500/30"
                              >
                                <Square className="w-6 h-6 fill-white" />
                              </button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="idle"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center gap-6 w-full"
                            >
                              <p className="text-white/60 text-sm italic mb-4">"{result?.interviewQuestions?.[selectedInterviewQuestion] || "Please select a question to begin."}"</p>
                              
                              <textarea 
                                value={interviewAnswer}
                                onChange={(e) => setInterviewAnswer(e.target.value)}
                                placeholder="Type your answer or record..."
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan/50 transition-all resize-none"
                              />

                              <div className="flex gap-4">
                                <button 
                                  onClick={toggleRecording}
                                  className="w-14 h-14 bg-cyan rounded-full flex items-center justify-center text-navy hover:scale-110 transition-all shadow-lg shadow-cyan/30"
                                >
                                  <Mic className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={handleInterviewPractice}
                                  disabled={isAnalyzingInterview || (!interviewAnswer && !recordedAudio)}
                                  className="px-8 py-4 bg-white text-navy font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                                >
                                  {isAnalyzingInterview ? "Analyzing AI..." : "Get Feedback"}
                                </button>
                                {recordedAudio && (
                                  <button 
                                    onClick={() => {
                                      setRecordedAudio(null);
                                      setInterviewAnswer("");
                                      setInterviewFeedback(null);
                                    }}
                                    className="px-4 py-2 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-white/20 transition-all"
                                  >
                                    Reset Audio
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isAnalyzingInterview && (
                          <div className="absolute inset-0 bg-navy/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1 }}
                            >
                              <Loader2 className="w-8 h-8 text-cyan" />
                            </motion.div>
                            <p className="text-white text-[10px] font-black uppercase tracking-widest">Processing Voice & Clarity...</p>
                          </div>
                        )}
                      </div>

                      {/* Feedback Display */}
                      <AnimatePresence>
                        {interviewFeedback && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="mt-12 bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200"
                            >
                              {/* Report Header */}
                              <div className="bg-navy p-8 text-white">
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <h3 className="text-cyan text-[10px] font-black uppercase tracking-[0.3em] mb-2">Interview Performance Report</h3>
                                    <p className="text-white/60 text-[9px] font-medium uppercase tracking-widest italic font-mono">Reference ID: #VELAA-{Math.floor(Math.random()*10000)}</p>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <div className="text-4xl font-black text-cyan tracking-tighter">{interviewFeedback.confidenceScore}%</div>
                                    <div className="text-[10px] font-black uppercase text-white/40 tracking-widest">Confidence Score</div>
                                  </div>
                                </div>

                                {interviewFeedback.transcript && (
                                  <div className="p-6 bg-white/5 rounded-2xl border border-white/10 mb-2">
                                    <h4 className="text-[9px] font-black text-cyan uppercase tracking-widest mb-3 flex items-center gap-2">
                                      <ClipboardCheck className="w-3 h-3" /> Transcribed Answer
                                    </h4>
                                    <p className="text-xs text-white/90 leading-relaxed font-medium italic">
                                      "{interviewFeedback.transcript}"
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Report Body */}
                              <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                      <h4 className="text-[10px] font-black text-navy uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-cyan" /> Tone Analysis
                                      </h4>
                                      <p className="text-xs text-navy leading-relaxed font-bold mb-3">{interviewFeedback.confidenceAnalysis}</p>
                                      <p className="text-xs text-slate-500 leading-relaxed font-medium">{interviewFeedback.clarity}</p>
                                    </div>

                                    <div className={cn(
                                      "p-6 rounded-2xl border flex items-center justify-between",
                                      interviewFeedback.starStructure ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                                    )}>
                                      <div>
                                        <h4 className={cn("text-[10px] font-black uppercase tracking-widest mb-1", interviewFeedback.starStructure ? "text-emerald-700" : "text-amber-700")}>
                                          STAR Method Audit
                                        </h4>
                                        <p className="text-[10px] font-medium text-slate-600">
                                          {interviewFeedback.starStructure 
                                            ? "Your answer effectively covers Situation, Task, Action, and Result." 
                                            : "Try to more clearly define the specific Result of your actions."}
                                        </p>
                                      </div>
                                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", interviewFeedback.starStructure ? "bg-emerald-200" : "bg-amber-200")}>
                                        {interviewFeedback.starStructure ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <AlertTriangle className="w-5 h-5 text-amber-700" />}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-6 bg-navy rounded-2xl shadow-xl border border-white/10">
                                    <h4 className="text-[10px] font-black text-cyan uppercase tracking-widest mb-6 flex items-center gap-2">
                                      <Target className="w-4 h-4" /> Performance Highlights
                                    </h4>
                                    <div className="space-y-6">
                                      <div>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase mb-3 tracking-widest">Core Strengths</p>
                                        <div className="space-y-2">
                                          {interviewFeedback.strengths?.map((s, i) => (
                                            <div key={i} className="text-xs text-white flex items-start gap-3">
                                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /> 
                                              <span className="font-medium">{s}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-black text-rose-400 uppercase mb-3 tracking-widest">Growth Opportunities</p>
                                        <div className="space-y-2">
                                          {interviewFeedback.blindSpots?.map((s, i) => (
                                            <div key={i} className="text-xs text-white/70 flex items-start gap-3">
                                              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                                              <span className="font-medium">{s}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {interviewFeedback.suggestedAnswer && (
                                  <div className="p-8 bg-cyan/5 border-2 border-dashed border-cyan/20 rounded-3xl relative">
                                    <div className="absolute -top-3 left-8 px-4 bg-cyan text-navy text-[10px] font-black uppercase tracking-widest py-1 rounded-full shadow-lg">
                                      Try Saying This (Velaa AI Recommendation)
                                    </div>
                                    <p className="text-sm text-navy leading-relaxed font-semibold italic text-center px-4">
                                      "{interviewFeedback.suggestedAnswer}"
                                    </p>
                                  </div>
                                )}

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-cyan">
                                      <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Growth Advisor</p>
                                      <p className="text-xs text-navy font-bold">{interviewFeedback.overall}</p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setInterviewFeedback(null);
                                      setRecordedAudio(null);
                                      setInterviewAnswer("");
                                    }}
                                    className="px-8 py-3 bg-navy text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan hover:text-navy transition-all active:scale-95 shadow-xl hover:shadow-cyan/20"
                                  >
                                    Re-Practice session
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Story Vault Section */}
                      <div className="mt-12">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <History className="w-4 h-4" /> The Story Vault
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {stories.map((story) => (
                            <div key={story.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                              <h4 className="text-[10px] font-black text-navy uppercase tracking-tight mb-3">{story.title}</h4>
                              <textarea 
                                value={story.content}
                                onChange={(e) => handleStoryUpdate(story.id, e.target.value)}
                                placeholder="Draft your project story here..."
                                className="w-full h-24 text-[10px] bg-slate-50 rounded-lg p-3 outline-none focus:ring-1 focus:ring-cyan resize-none mb-3 font-medium"
                              />
                              <button 
                                onClick={() => handleAuditStory(story.id)}
                                disabled={isAuditingStory === story.id || !story.content.trim()}
                                className="w-full py-2 bg-navy text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-cyan hover:text-navy transition-all disabled:opacity-50"
                              >
                                {isAuditingStory === story.id ? "Auditing..." : "AI Story Audit"}
                              </button>
                              {story.audit && (
                                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                                      story.audit.hasResult ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                    )}>
                                      {story.audit.hasResult ? "Result Found" : "Missing Result"}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-600 leading-tight mb-2">{story.audit.summary}</p>
                                  {!story.audit.hasResult && (
                                    <p className="text-[9px] text-rose-500 font-bold leading-tight italic">Suggestion: {story.audit.suggestion}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sync Cards */}
                    {[
                      { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { id: 'naukri', label: 'Naukri', icon: ExternalLink, color: 'text-rose-600', bg: 'bg-rose-50' }
                    ].map((platform) => (
                      <div key={platform.id} className="p-8 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between mb-6">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", platform.bg, platform.color)}>
                            <platform.icon className="w-6 h-6" />
                          </div>
                          {syncedProfiles[platform.id as 'linkedin' | 'naukri'] ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                              <ShieldCheck className="w-3 h-3" /> Synced
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-slate-400">Not Connected</span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-navy mb-2">Sync {platform.label} Profile</h3>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                          Pull your latest skills, certifications, and experience directly from {platform.label}.
                        </p>
                        
                        <button 
                          onClick={() => platform.id === 'linkedin' ? loginLinkedIn() : handleProfileSync(platform.id as 'naukri')}
                          disabled={!!isSyncing || authStatus === 'pending'}
                          className={cn(
                            "w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                            syncedProfiles[platform.id as 'linkedin' | 'naukri']
                              ? "bg-slate-100 text-slate-400 cursor-default"
                              : "bg-navy text-white hover:bg-cyan hover:text-navy active:scale-95 border-2 border-transparent hover:border-cyan hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                          )}
                        >
                          {isSyncing === platform.id || (platform.id === 'linkedin' && authStatus === 'pending') ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : syncedProfiles[platform.id as 'linkedin' | 'naukri'] ? (
                            "Connection Active"
                          ) : (
                            `Connect ${platform.label}`
                          )}
                        </button>
                        
                        {isSyncing === platform.id && (
                          <p className="text-[9px] text-center text-slate-400 mt-4 animate-pulse uppercase font-bold tracking-widest">
                            Secured by 256-bit Encryption
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AI Analysis Result */}
                  <AnimatePresence>
                    {profileAnalysis && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div className="p-8 bg-navy rounded-2xl border border-white/10 shadow-2xl">
                          <h3 className="text-cyan text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> Unified Corporate Identity
                          </h3>
                          <p className="text-white text-sm leading-relaxed font-medium italic">
                            "{profileAnalysis.unifiedIdentity}"
                          </p>
                          <div className="mt-6 flex gap-4">
                            <button className="text-[10px] font-black text-white/60 hover:text-white uppercase tracking-widest flex items-center gap-2">
                              <ClipboardCheck className="w-3 h-3" /> Batch Update All
                            </button>
                          </div>
                        </div>

                        {profileAnalysis.inconsistencies.length > 0 && (
                          <div className="p-8 bg-amber-50 border border-amber-100 rounded-2xl">
                            <h3 className="text-amber-600 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" /> Profile Inconsistencies Found
                            </h3>
                            <ul className="space-y-3">
                              {profileAnalysis.inconsistencies.map((err, i) => (
                                <li key={i} className="flex items-start gap-3 text-xs text-amber-800 font-medium">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                  {err}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === "applications" && (
                <motion.div
                  key="applications"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-navy mb-2">My Applications</h2>
                    <p className="text-sm text-slate-500 font-medium">Tracking your official career transmissions.</p>
                  </div>

                  {myApplications.length > 0 ? (
                    <div className="grid gap-4">
                      {myApplications.map((app, idx) => (
                        <div key={idx} className="p-6 bg-white border border-slate-200 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-lg transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-navy border border-slate-100">
                              <Briefcase className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-navy uppercase text-sm">{app.company}</h4>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{app.role}</p>
                              <p className="text-[10px] text-slate-400 mt-1">Applied on {app.appliedAt} via {app.platform}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Status</p>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                app.status === "Submitted" ? "bg-emerald-50 text-emerald-600" :
                                app.status === "Under Review" ? "bg-amber-50 text-amber-600" :
                                "bg-cyan/10 text-cyan"
                              )}>
                                {app.status}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">ID</p>
                              <span className="font-mono text-xs text-navy font-bold">{app.trackingId}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-400 font-black uppercase tracking-[0.3em]">No applications found</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "recruiter" && userRole === 'recruiter' && (
                <motion.div
                  key="recruiter"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-12"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-cyan flex items-center justify-center text-navy">
                          <Shield className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tight text-navy">Recruiter Portal</h2>
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Access verified freshers with 100% Roadmap completion.</p>
                    </div>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="Filter by Skill..."
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan"
                        value={recruiterFilters.skill}
                        onChange={(e) => setRecruiterFilters(prev => ({ ...prev, skill: e.target.value }))}
                      />
                      <input 
                        type="text" 
                        placeholder="Location..."
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-cyan"
                        value={recruiterFilters.location}
                        onChange={(e) => setRecruiterFilters(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoadingCandidates ? (
                      Array(6).fill(0).map((_, i) => (
                        <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
                      ))
                    ) : candidates.length > 0 ? (
                      candidates
                        .filter(c => 
                          (!recruiterFilters.skill || c.skills?.some((s: string) => s.toLowerCase().includes(recruiterFilters.skill.toLowerCase()))) &&
                          (!recruiterFilters.location || c.location?.toLowerCase().includes(recruiterFilters.location.toLowerCase()))
                        )
                        .map((candidate, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-cyan"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-navy text-lg uppercase">
                                {candidate.displayName?.charAt(0) || "C"}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-navy uppercase">{candidate.displayName}</h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{candidate.location || "Location Private"}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 mb-6 h-16 overflow-hidden">
                              {candidate.skills?.slice(0, 4).map((skill: string, i: number) => (
                                <span key={i} className="px-2 py-1 bg-slate-50 text-slate-600 rounded text-[9px] font-black uppercase tracking-tighter">
                                  {skill}
                                </span>
                              ))}
                            </div>

                            <button 
                              onClick={() => handleRequestInterview(candidate.uid)}
                              className="w-full py-3 bg-navy text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan hover:text-navy transition-all"
                            >
                              Shortlist Candidate
                            </button>
                          </motion.div>
                        ))
                    ) : (
                      <div className="col-span-full py-20 text-center">
                        <p className="text-slate-400 font-black uppercase tracking-[0.3em]">No candidates matched filters</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Features Comparison */}
        <section className="mt-24">
          <p className="mb-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Velaa uses your data only for job matching. We never sell your profile info to third-party advertisers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { icon: CheckCircle2, title: "ATS Validation", desc: "Military-grade keyword extraction for MNC compliance.", color: "text-emerald-500", bg: "bg-emerald-50" },
            { icon: Sparkles, title: "Smart Sourcing", desc: "Predictive matching based on 2026 market velocity.", color: "text-purple-500", bg: "bg-purple-50" },
            { icon: Target, title: "Career Tips", desc: "Step-by-step guides for landing your first role.", color: "text-cyan", bg: "bg-cyan/5" },
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-xl bg-white border border-slate-100 shadow-xl shadow-navy/[0.02] text-center group hover:scale-105 transition-all">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm", feature.bg, feature.color)}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h4 className="font-black text-navy uppercase tracking-widest text-xs mb-3">{feature.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
            </div>
          ))}
          </div>
        </section>
      </main>

      <footer className="bg-navy py-20 mt-24 text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center gap-4 mb-10">
            <Logo className="w-12 h-auto aspect-[100/60]" />
            <span className="text-3xl font-black tracking-tighter font-sans uppercase text-cyan">Velaa Intelligence</span>
          </div>
          <p className="text-white/40 text-sm mb-12 max-w-lg mx-auto leading-relaxed">
            Quantifying potential for the next generation of Indian engineering leaders. 
            Standardizing the path from education to enterprise.
          </p>
          <div className="flex justify-center gap-12 text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
            <button onClick={() => setShowPrivacy(true)} className="hover:text-cyan transition-colors">Privacy / Secure</button>
            <button onClick={() => setShowRoadmap(true)} className="hover:text-cyan transition-colors">Velaa Roadmap</button>
            <button onClick={() => setShowSupport(true)} className="hover:text-cyan transition-colors">Support Terminal</button>
          </div>
        </div>
      </footer>

      {/* Negotiation Coach Bubble */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <AnimatePresence>
          {showNegotiationCoach && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-16 right-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden shadow-navy/20"
            >
              <div className="bg-navy p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo className="w-6 h-auto aspect-[100/60]" />
                  <span className="text-white text-xs font-black uppercase tracking-widest">Salary Coach</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleHardRefresh}
                    title="Hard Refresh Session"
                    className="p-1 px-2 text-[8px] font-black uppercase bg-white/10 hover:bg-white/20 text-cyan rounded-md transition-all flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset
                  </button>
                  <button onClick={() => setShowNegotiationCoach(false)} className="text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="h-64 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {negotiationChat.length === 0 && (
                  <p className="text-[10px] text-slate-400 text-center font-bold uppercase mt-12 px-6">Ask me anything about Salary, Perks, or Negotiation Scripts.</p>
                )}
                {negotiationChat.map((msg, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-xl max-w-[85%] text-xs font-medium leading-relaxed",
                    msg.role === 'user' ? "ml-auto bg-cyan text-navy font-bold" : "mr-auto bg-white border border-slate-100 text-slate-600 shadow-sm"
                  )}>
                    {msg.text}
                  </div>
                ))}
                {isNegotiating && (
                  <div className="mr-auto p-3 bg-white border border-slate-100 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan" />
                  </div>
                )}
              </div>
              <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={negotiationQuery}
                  onChange={(e) => setNegotiationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNegotiationSubmit()}
                  placeholder="e.g. Ask for 20% more"
                  className="flex-1 text-xs p-2 bg-slate-50 rounded-lg outline-none focus:ring-1 focus:ring-cyan"
                />
                <button 
                  onClick={handleNegotiationSubmit}
                  disabled={isNegotiating}
                  className="p-2 bg-navy text-cyan rounded-lg"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setShowNegotiationCoach(!showNegotiationCoach)}
          className="w-14 h-14 bg-navy rounded-full flex items-center justify-center text-cyan shadow-2xl hover:scale-110 transition-all group pointer-events-auto"
        >
          <MessageSquare className="w-6 h-6 group-hover:hidden" />
          <Zap className="w-6 h-6 hidden group-hover:block animate-pulse" />
        </button>
      </div>
      {/* Velaa Roadmap Modal */}
      <AnimatePresence>
        {showRoadmap && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRoadmap(false)}
              className="absolute inset-0 bg-navy/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-navy p-8 text-white relative">
                <button onClick={() => setShowRoadmap(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2">Velaa Roadmap</h3>
                <p className="text-[10px] font-black text-cyan uppercase tracking-widest">Your journey to a professional role</p>
              </div>
              <div className="p-8 space-y-8">
                {[
                  { id: 'resumeAnalyzed', label: 'Resume Analyzed', desc: 'ATS matching score calculated', status: userProgress.resumeAnalyzed },
                  { id: 'profilesSynced', label: 'LinkedIn/Naukri Synced', desc: 'Professional data verified', status: userProgress.profilesSynced },
                  { id: 'interviewPracticed', label: 'Interview Practiced', desc: 'AI feedback report generated', status: userProgress.interviewPracticed },
                  { id: 'applicationSent', label: 'Application Sent', desc: 'Velaa-optimized application submitted', status: userProgress.applicationSent },
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
                        step.status ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        {step.status ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      {idx < 3 && <div className={cn("w-0.5 grow mt-2 mb-2", step.status ? "bg-emerald-200" : "bg-slate-100")} />}
                    </div>
                    <div>
                      <h4 className={cn("text-xs font-black uppercase mb-1", step.status ? "text-navy" : "text-slate-400")}>{step.label}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy & Purge Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPrivacy(false)}
              className="absolute inset-0 bg-navy/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-emerald-600 p-8 text-white relative">
                <button onClick={() => setShowPrivacy(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-6 h-6" />
                  <h3 className="text-xl font-black uppercase tracking-tight">Privacy Commitment</h3>
                </div>
                <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">AES-256 Military Grade Encryption</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs text-navy leading-relaxed font-medium">
                    At Velaa, we treat your professional data with extreme care. All resumes, profile syncs, and interview recordings are encrypted with AES-256. We never share your data with third parties without explicit consent.
                  </p>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Data Purge</h4>
                  <p className="text-[10px] text-rose-800 font-medium mb-4">You have the "Right to be Forgotten". Clicking below will instantly and permanently erase your entire data footprint from our servers.</p>
                  <button 
                    onClick={handlePurgeData}
                    className="w-full py-3 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Purge My Entire Data Footprint
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Application Receipt Modal */}
      <AnimatePresence>
        {showApplyReceipt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <div className="bg-navy p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan/20 via-transparent to-transparent opacity-50" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-cyan rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-12 shadow-lg shadow-cyan/40">
                    <CheckCircle2 className="w-10 h-10 text-navy" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Application Sent</h3>
                  <p className="text-cyan/60 text-xs font-black uppercase tracking-[0.2em]">{showApplyReceipt.id}</p>
                </div>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Transmission Details</p>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase">Target Company</span>
                      <span className="font-black text-navy uppercase text-sm">{showApplyReceipt.company}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase">Role</span>
                      <span className="font-black text-navy uppercase text-sm">{showApplyReceipt.role}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase">Resume Version</span>
                      <span className="font-black text-navy uppercase text-sm">Velaa-Optimized-V2.pdf</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase">Applied On</span>
                      <span className="font-black text-navy uppercase text-sm whitespace-nowrap">{showApplyReceipt.timestamp.split(',')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase">Velaa Sync Ready</h5>
                    <p className="text-[10px] text-slate-500 font-medium">Tracking active in 'My Applications' tab.</p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowApplyReceipt(null)}
                  className="w-full py-4 bg-navy text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-cyan hover:text-navy transition-all shadow-lg"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support Terminal Slide-out */}
      <AnimatePresence>
        {showSupport && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSupport(false)}
              className="fixed inset-0 z-[100] bg-navy/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[110] shadow-2xl flex flex-col"
            >
              <div className="p-8 bg-navy text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">Support Terminal</h3>
                  <p className="text-[10px] font-black text-cyan uppercase tracking-widest">Direct access to career advisors</p>
                </div>
                <button onClick={() => setShowSupport(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 grow">
                <form onSubmit={handleSupportSubmit} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-navy uppercase tracking-widest mb-2 block">Tell us your issue or feedback</label>
                    <textarea 
                      name="query"
                      required
                      placeholder="e.g., I need help with my Amazon resume optimization..."
                      className="w-full h-48 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:border-cyan transition-all resize-none font-medium"
                    />
                  </div>
                  <button className="w-full py-4 bg-navy text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-cyan hover:text-navy transition-all shadow-xl shadow-navy/20">
                    Submit Access Query
                  </button>
                </form>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase tracking-widest text-center">
                  Encrypted Support Session // Response within 24 Hours
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

