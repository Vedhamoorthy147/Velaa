import dotenv from "dotenv";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import crypto from "crypto";
import cors from "cors";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared state for LinkedIn profile (In a real app, this should be in session/database)
let syncedLinkedInProfile: any = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: ["https://ai.studio", /\.ai\.studio$/],
    credentials: true
  }));
  app.use(express.json());

  // Global logging middleware to debug 404s
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Velaa Career Assistant Backend is running" });
  });

  // LinkedIn OAuth Routes - Client will handle state at root
  const REDIRECT_URI = process.env.APP_URL
    ? `${process.env.APP_URL}/auth/linkedin/callback`
    : 'http://localhost:3000/auth/linkedin/callback';

  // API endpoint for client to exchange code for profile (Pattern 2: Secure POST exchange)
  app.post("/api/linkedin/callback", async (req, res) => {
    const { code } = req.body;
    console.log("[OAUTH] Secure token exchange requested via POST");

    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }

    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("ERROR: LinkedIn Secrets not found in Environment");
        return res.status(500).json({ error: "Server configuration error: Missing secrets." });
      }

      const tokenResponse = await axios.post("https://www.linkedin.com/oauth/v2/accessToken", 
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI, // Root URI is used because that's where the popup initially lands
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      
      const accessToken = tokenResponse.data.access_token;
      
      const profileResponse = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const profile = profileResponse.data;
      console.log("[OAUTH] Sync successful for:", profile.name);

      res.json(profile);
    } catch (err: any) {
      const errorDetail = err.response?.data || err.message;
      console.error("[OAUTH] Exchange Error:", errorDetail);
      res.status(500).json({ error: "Failed to exchange token", detail: errorDetail });
    }
  });

  // API endpoint for client to exchange code for profile (LEGACY - keeping for compat)
  app.post("/api/auth/linkedin/exchange", async (req, res) => {
    const { code } = req.body;
    console.log("[OAUTH] Token exchange requested via POST for code");

    if (!code) {
      return res.status(400).json({ error: "No code provided" });
    }

    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error("ERROR: LinkedIn Secrets not found in Environment");
        return res.status(500).json({ error: "Server configuration error: Missing secrets." });
      }

      console.log("[OAUTH] Exchanging code for token with LinkedIn...");
      const tokenResponse = await axios.post("https://www.linkedin.com/oauth/v2/accessToken", 
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      
      const accessToken = tokenResponse.data.access_token;
      
      // Fetch user profile
      const profileResponse = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      syncedLinkedInProfile = profileResponse.data;
      console.log("[OAUTH] Exchange & Sync successful for:", syncedLinkedInProfile.name);

      res.json(syncedLinkedInProfile);
    } catch (err: any) {
      const errorDetail = err.response?.data || err.message;
      console.error("[OAUTH] Exchange Error:", errorDetail);
      res.status(500).json({ error: "Failed to exchange token", detail: errorDetail });
    }
  });
// ── REAL JOB LISTINGS (Adzuna API) ──
app.get("/api/jobs", async (req, res) => {
  const role = (req.query.role as string) || "software engineer";
  const location = (req.query.location as string) || "india";
  const page = (req.query.page as string) || "1";

  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;

  if (!appId || !apiKey) {
    // Return curated fallback jobs if no API key yet
    return res.json([
      { id: "1", title: "Software Engineer", company: { display_name: "TCS" }, location: { display_name: "Bengaluru" }, salary_min: 400000, salary_max: 800000, redirect_url: "https://www.naukri.com", description: "Join TCS as a Software Engineer.", created: new Date().toISOString() },
      { id: "2", title: "Product Manager", company: { display_name: "Infosys" }, location: { display_name: "Hyderabad" }, salary_min: 800000, salary_max: 1500000, redirect_url: "https://www.naukri.com", description: "Lead product development at Infosys.", created: new Date().toISOString() },
      { id: "3", title: "Data Analyst", company: { display_name: "Wipro" }, location: { display_name: "Chennai" }, salary_min: 350000, salary_max: 700000, redirect_url: "https://www.naukri.com", description: "Analyze business data at Wipro.", created: new Date().toISOString() },
    ]);
  }

  try {
    const url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?app_id=${appId}&app_key=${apiKey}&results_per_page=10&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&content-type=application/json`;
    const response = await axios.get(url);
    res.json(response.data.results || []);
  } catch (err: any) {
    console.error("[JOBS] Adzuna fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});
  app.get("/api/auth/linkedin/url", (req, res) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      console.error("ERROR: LinkedIn Secrets not found in Environment");
      return res.status(500).json({ error: "LINKEDIN_CLIENT_ID not configured" });
    }
    const state = crypto.randomBytes(16).toString("hex");
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state: state,
      scope: "openid profile email",
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/user/linkedin-profile", (req, res) => {
    res.json(syncedLinkedInProfile || null);
  });

  // Common keywords matching database (simulated for now, can be moved to Firestore later)
  const jobKeywords = {
    "TCS": ["SQL", "Java", "Python", "Data Structures", "Algorithms", "Agile"],
    "Zoho": ["Product Design", "JavaScript", "Deluge", "C#", "Cloud Services"],
    "Wipro": ["Networking", "Cybersecurity", "Technical Support", "Cloud Infrastructure"],
    "Data Entry": ["Excel", "Typing Speed", "Data Validation", "MS Office"],
    "BPO": ["Communication Skills", "Customer Support", "Listening", "Problem Solving"],
    "Python Intern": ["Python", "Flask", "Django", "NumPy", "Pandas"],
    "Digital Marketing": ["SEO", "SEM", "Social Media", "Content Writing", "Analytics"]
  };

  app.get("/api/keywords", (req, res) => {
    res.json(jobKeywords);
  });

  app.get("/auth/linkedin/callback", (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    res.send(`<!DOCTYPE html>
<html>
<body>
<p>Connecting your LinkedIn profile...</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage({ type: 'LINKEDIN_CODE', code: '${code}', state: '${state}' }, '*');
    }
  } catch(e) {
    console.error(e);
  }
  setTimeout(() => window.close(), 1000);
</script>
</body>
</html>`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
