import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const cache: { data: any[]; time: number } = { data: [], time: 0 };
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default async function handler(req: VercelRequest, res: VercelResponse) {
const role = (req.query.role as string) || "software engineer";
const location = (req.query.location as string) || "india";
const city = (req.query.city as string) || "";
const experience = (req.query.experience as string) || "";
const searchQuery = `${role} ${experience} in ${city || location}`;

  if (cache.data.length > 0 && Date.now() - cache.time < CACHE_TTL) {
    return res.json(cache.data);
  }

  const results: any[] = [];

  // 1 — JSearch (Google Jobs — best India coverage)
  try {
    const jsearchRes = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: { query: searchQuery, page: '1', num_pages: '1', date_posted: 'month' },
      headers: {
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY || ''
      }
    });
    const jsearchJobs = (jsearchRes.data.data || []).map((j: any) => ({
      id: j.job_id,
      title: j.job_title,
      company: { display_name: j.employer_name },
      location: { display_name: `${j.job_city || ''} ${j.job_country || 'India'}`.trim() },
      salary_min: j.job_min_salary || null,
      salary_max: j.job_max_salary || null,
      description: j.job_description?.slice(0, 200) || '',
      redirect_url: j.job_apply_link,
      source: 'Google Jobs'
    }));
    results.push(...jsearchJobs);
  } catch (err: any) {
    console.error('[JOBS] JSearch failed:', err.message);
  }

  // 2 — Adzuna
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const apiKey = process.env.ADZUNA_API_KEY;
    if (appId && apiKey) {
      const adzunaRes = await axios.get(
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=10&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&content-type=application/json`
      );
      const adzunaJobs = (adzunaRes.data.results || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: { display_name: j.company?.display_name || 'Company' },
        location: { display_name: j.location?.display_name || 'India' },
        salary_min: j.salary_min || null,
        salary_max: j.salary_max || null,
        description: j.description?.slice(0, 200) || '',
        redirect_url: j.redirect_url,
        source: 'Adzuna'
      }));
      results.push(...adzunaJobs);
    }
  } catch (err: any) {
    console.error('[JOBS] Adzuna failed:', err.message);
  }

  // 3 — Jobicy (no API key needed)
  try {
    const jobicyRes = await axios.get(
      `https://jobicy.com/api/v2/remote-jobs?count=10&geo=india&industry=${encodeURIComponent(role)}`
    );
    const jobicyJobs = (jobicyRes.data.jobs || []).map((j: any) => ({
      id: j.id,
      title: j.jobTitle,
      company: { display_name: j.companyName },
      location: { display_name: j.jobGeo || 'Remote, India' },
      salary_min: null,
      salary_max: null,
      description: j.jobExcerpt?.slice(0, 200) || '',
      redirect_url: j.url,
      source: 'Jobicy'
    }));
    results.push(...jobicyJobs);
  } catch (err: any) {
    console.error('[JOBS] Jobicy failed:', err.message);
  }

  // Remove duplicates by title + company
  const seen = new Set();
  const unique = results.filter(j => {
    const key = `${j.title?.toLowerCase()}-${j.company?.display_name?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cache and return
  cache.data = unique;
  cache.time = Date.now();

  res.json(unique.length > 0 ? unique : [
    { id: "1", title: "Software Engineer", company: { display_name: "TCS" }, location: { display_name: "Bengaluru, India" }, redirect_url: "https://www.naukri.com", description: "Join TCS as a Software Engineer.", source: "Fallback" },
    { id: "2", title: "Product Manager", company: { display_name: "Infosys" }, location: { display_name: "Hyderabad, India" }, redirect_url: "https://www.naukri.com", description: "Lead product development at Infosys.", source: "Fallback" },
  ]);
}