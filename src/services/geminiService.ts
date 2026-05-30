export interface AnalysisResult {
  atsScore: number;
  missingSkills: string[];
  matchedJobs: {
    title: string;
    description: string;
    matchRate: number;
  }[];
  tips: string;
  culture?: string;
  trends?: string;
  extractedText?: string;
  salaryIntelligence?: {
    range: string;
    locationComparison: string;
  };
  interviewQuestions?: string[];
  improvedResume?: string;
}

export interface InterviewFeedbackResponse {
  transcript?: string;
  confidenceScore: number;
  confidenceAnalysis: string;
  clarity: string;
  keywords: string;
  starStructure: boolean;
  strengths: string[];
  blindSpots: string[];
  suggestedAnswer: string;
  overall: string;
}

// ─── Groq caller ────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── JSON helper ────────────────────────────────────────────────────────────

function sanitizeJSON(text: string): string {
  let sanitized = text.replace(/```json\n?/, "").replace(/\n?```/, "");
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    sanitized = sanitized.substring(start, end + 1);
  }
  return sanitized;
}

// ─── Functions ──────────────────────────────────────────────────────────────

export async function analyzeResume(
  input: string | { data: string; mimeType: string },
  targetCompany: string,
  targetRole: string,
  cachedInsights?: { culture?: string; trends?: string },
  syncedData?: string
): Promise<AnalysisResult> {

  // Groq is text-only — if image is passed, we can't process it
  if (typeof input !== "string") {
    throw new Error("IMAGE_NOT_SUPPORTED");
  }

  const prompt = `
    Analyze this resume for an Indian fresher:
    "${input}"

    ${syncedData ? `
    EXTERNAL SYNCED DATA (LinkedIn/Naukri):
    "${syncedData}"
    If this data contains skills or experiences NOT in the resume, highlight them as "Missing from Resume but available in synced profiles".
    ` : ""}

    Goal: Evaluate suitability for the role of "${targetRole}" at "${targetCompany}" in 2026.

    ${cachedInsights ? `
    PRE-RESEARCH DATA (Already known for ${targetCompany}):
    - Culture: ${cachedInsights.culture}
    - 2026 Market Trends: ${cachedInsights.trends}
    Use this to fast-track your research.
    ` : ""}

    CRITICAL INSTRUCTIONS:
    1. Only use skills and experiences explicitly mentioned in the resume.
    2. Use your knowledge of 2026 hiring standards for "${targetRole}" at "${targetCompany}".
    3. Return ONLY a valid JSON object. No markdown. No text before or after.
    4. Generate exactly 5 interview questions — 2 behavioral (STAR-based) and 3 technical.
    5. Provide a rewritten resume optimized for this role.

    JSON structure:
    {
      "atsScore": number,
      "missingSkills": string[],
      "matchedJobs": [{ "title": string, "description": string, "matchRate": number }],
      "tips": string,
      "culture": string,
      "trends": string,
      "extractedText": string,
      "salaryIntelligence": { "range": string, "locationComparison": string },
      "interviewQuestions": string[],
      "improvedResume": string
    }
  `;

  try {
    const text = await callGroq(prompt);
    const result = JSON.parse(sanitizeJSON(text));
    return {
      atsScore: result.atsScore || 0,
      missingSkills: result.missingSkills || [],
      matchedJobs: result.matchedJobs || [],
      tips: result.tips || "Keep updated with latest trends.",
      culture: result.culture,
      trends: result.trends,
      extractedText: result.extractedText,
      salaryIntelligence: result.salaryIntelligence,
      interviewQuestions: result.interviewQuestions,
      improvedResume: result.improvedResume,
    };
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
}

export async function generateCoverLetter(
  resumeText: string,
  company: string,
  role: string
): Promise<string> {
  const prompt = `
    Based on this resume: "${resumeText.substring(0, 4000)}"
    Generate a professional, tailored cover letter for "${role}" at "${company}".
    Tone: confident but humble, suitable for an Indian fresher.
    Focus on how the candidate's existing skills solve problems for ${company}.
    Keep it under 300 words. Return plain text only, no JSON.
  `;

  try {
    return await callGroq(prompt);
  } catch (error) {
    console.error("Cover letter error:", error);
    return "Error generating cover letter. Please try again.";
  }
}

export async function generateInterviewFeedback(
  question: string,
  answer: string | { data: string; mimeType: string }
): Promise<InterviewFeedbackResponse> {

  // Groq is text-only — audio not supported
  const answerText = typeof answer === "string"
    ? answer
    : "(Audio recording received but transcription is not available on the current plan. Please type your answer instead.)";

  const prompt = `
    Analyze this interview answer for the question: "${question}"
    User's Answer: "${answerText}"

    1. Evaluate if it follows the STAR structure.
    2. Check confidence based on vocabulary and directness.
    3. Identify key industry keywords used or missing.
    4. Provide a Confidence Score (0-100).
    5. Provide a better suggested answer.

    Return ONLY valid JSON:
    {
      "transcript": "${answerText}",
      "confidenceScore": number,
      "confidenceAnalysis": string,
      "clarity": string,
      "keywords": string,
      "starStructure": boolean,
      "strengths": [3 strings],
      "blindSpots": [2 strings],
      "suggestedAnswer": string,
      "overall": string
    }
  `;

  try {
    const text = await callGroq(prompt);
    return JSON.parse(sanitizeJSON(text));
  } catch (error) {
    console.error("Interview feedback error:", error);
    return {
      confidenceScore: 0,
      confidenceAnalysis: "Error",
      clarity: "Error",
      keywords: "Error",
      starStructure: false,
      strengths: ["Error analyzing"],
      blindSpots: ["Error analyzing"],
      suggestedAnswer: "Error generating suggestion.",
      overall: "Error analyzing answer.",
    };
  }
}

export async function auditStory(
  story: string
): Promise<{ audit: string; hasResult: boolean; suggestion: string }> {
  const prompt = `
    Analyze this professional project story:
    "${story}"

    1. Check for a measurable result (e.g., "Increased efficiency by 20%").
    2. Provide a short audit summary.
    3. If no measurable result, suggest how to quantify the achievement.

    Return ONLY valid JSON:
    {
      "audit": string,
      "hasResult": boolean,
      "suggestion": string
    }
  `;

  try {
    const text = await callGroq(prompt);
    return JSON.parse(sanitizeJSON(text));
  } catch (error) {
    console.error("Story audit error:", error);
    return { audit: "Error auditing", hasResult: false, suggestion: "Try adding numbers." };
  }
}

export async function getNegotiationAdvice(query: string): Promise<string> {
  const prompt = `
    You are a professional Negotiation Coach for Indian corporate jobs.
    User asks: "${query}"
    Provide a specific script or strategic advice for Indian freshers in 2026.
    Keep it actionable and under 150 words. Return plain text only.
  `;

  try {
    return await callGroq(prompt);
  } catch (error) {
    console.error("Negotiation advice error:", error);
    return "Error generating advice. Please try again.";
  }
}

export async function analyzeProfiles(
  resumeText: string,
  linkedinText: string,
  naukriText: string
): Promise<{ inconsistencies: string[]; unifiedIdentity: string }> {
  const prompt = `
    Analyze these professional profiles for an Indian fresher:
    Resume: "${resumeText.substring(0, 2000)}"
    LinkedIn: "${linkedinText.substring(0, 2000)}"
    Naukri/AI Profile: "${naukriText.substring(0, 2000)}"

    1. Find inconsistencies (date mismatches, different skill focus).
    2. Generate a unified professional summary combining the best from all profiles.

    Return ONLY valid JSON:
    {
      "inconsistencies": string[],
      "unifiedIdentity": string
    }
  `;

  try {
    const text = await callGroq(prompt);
    return JSON.parse(sanitizeJSON(text));
  } catch (error) {
    console.error("Profile analysis error:", error);
    return { inconsistencies: [], unifiedIdentity: "Unified identity generation failed." };
  }
}

export async function autoInjectKeywords(
  resumeText: string,
  missingKeywords: string[]
): Promise<{ summary: string; skillsSection: string; fullImprovedResume: string }> {
  const prompt = `
    You are an expert ATS optimizer.
    RESUME: "${resumeText.substring(0, 4000)}"
    MISSING KEYWORDS: ${missingKeywords.join(", ")}

    1. Rewrite the Professional Summary to naturally include at least 3 missing keywords.
    2. Rewrite the Skills section to include ALL missing keywords authentically.
    3. Provide the full improved resume with these changes applied.

    Return ONLY valid JSON:
    {
      "summary": string,
      "skillsSection": string,
      "fullImprovedResume": string
    }
  `;

  try {
    const text = await callGroq(prompt);
    return JSON.parse(sanitizeJSON(text));
  } catch (error) {
    console.error("Auto-inject error:", error);
    throw error;
  }
}