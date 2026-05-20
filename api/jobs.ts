import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const role = (req.query.role as string) || "software engineer";
  const location = (req.query.location as string) || "india";

  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;

  if (!appId || !apiKey) {
    return res.json([
      { id: "1", title: "Software Engineer", company: { display_name: "TCS" }, location: { display_name: "Bengaluru" }, salary_min: 400000, salary_max: 800000, redirect_url: "https://www.naukri.com", description: "Join TCS as a Software Engineer." },
      { id: "2", title: "Product Manager", company: { display_name: "Infosys" }, location: { display_name: "Hyderabad" }, salary_min: 800000, salary_max: 1500000, redirect_url: "https://www.naukri.com", description: "Lead product development at Infosys." },
      { id: "3", title: "Data Analyst", company: { display_name: "Wipro" }, location: { display_name: "Chennai" }, salary_min: 350000, salary_max: 700000, redirect_url: "https://www.naukri.com", description: "Analyze business data at Wipro." },
    ]);
  }

  try {
    const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=10&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&content-type=application/json`;
    const response = await axios.get(url);
    res.json(response.data.results || []);
  } catch (err: any) {
    console.error("[JOBS] Adzuna fetch failed:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
}