import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

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

function sanitizeJSON(text: string): string {
  // Remove markdown code blocks if present
  let sanitized = text.replace(/```json\n?/, "").replace(/\n?```/, "");
  // Find the first '{' and last '}'
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    sanitized = sanitized.substring(start, end + 1);
  }
  return sanitized;
}

export async function analyzeResume(
  input: string | { data: string; mimeType: string }, 
  targetCompany: string,
  targetRole: string,
  cachedInsights?: { culture?: string; trends?: string },
  syncedData?: string
): Promise<AnalysisResult> {
  const isFileData = typeof input !== "string";
  
  const promptText = `
    Analyze this resume for an Indian fresher:
    ${!isFileData ? `"${input}"` : "The attached resume file."}

    ${syncedData ? `
    EXTERNAL SYNCED DATA (LinkedIn/Naukri):
    "${syncedData}"
    Note: If this data contains skills or experiences NOT in the resume, highlight them as "Missing from Resume but available in synced profiles".
    ` : ""}

    Goal: Evaluate suitability for the role of "${targetRole}" at "${targetCompany}" in 2026.
    
    ${cachedInsights ? `
    PRE-RESEARCH DATA (Already known for ${targetCompany}):
    - Culture: ${cachedInsights.culture}
    - 2026 Market Trends: ${cachedInsights.trends}
    Use this data to skip or fast-track your research.
    ` : ""}

    CRITICAL INSTRUCTIONS:
    1. FACTUAL ADHERENCE: Only use skills and experiences explicitly mentioned in the uploaded resume.
    2. LIVE RESEARCH: Use GOOGLE SEARCH for 2026 hiring standards for "${targetRole}" at "${targetCompany}".
    3. SANITIZATION: If descriptions are long, truncate to the most critical "Essential Keywords" and "Top Action Items" to prevent data overflow.
    4. STRICT OUTPUT: Return ONLY a valid JSON object. No markdown formatting. no text before or after.
    
    5. INTERVIEW PREP: Generate exactly 5 questions for "${targetRole}" at "${targetCompany}". Include 2 behavioral (STAR-based, e.g., "Tell me about a time...") and 3 technical/role-specific questions based on 2026 standards.
    6. IMPROVED RESUME: Provide a rewritten version of the user's resume that is highly optimized for the target role at this specific company. Use a clean, professional, and impact-driven format.
    
    Return a JSON response with the following structure:
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
      "improvedResume": "Standard single-column professional resume layout in plain text"
    }
  `;

  const contents = isFileData ? [
    {
      parts: [
        { inlineData: { data: input.data, mimeType: input.mimeType } },
        { text: promptText }
      ]
    }
  ] : [
    {
      parts: [{ text: promptText }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents as any,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      },
    });

    const sanitizedText = sanitizeJSON(response.text || "{}");
    const result = JSON.parse(sanitizedText);
    return {
      atsScore: result.atsScore || 0,
      missingSkills: result.missingSkills || [],
      matchedJobs: result.matchedJobs || [],
      tips: result.tips || "Keep updated with latest trends.",
      culture: result.culture,
      trends: result.trends,
      extractedText: result.extractedText,
      salaryIntelligence: result.salaryIntelligence,
      interviewQuestions: result.interviewQuestions
    };
  } catch (error) {
    console.error("Analysis error:", error);
    throw error;
  }
}

export async function generateCoverLetter(resumeText: string, company: string, role: string): Promise<string> {
  const prompt = `
    Based on this resume: "${resumeText.substring(0, 4000)}"
    Generate a professional, tailored cover letter for the position of "${role}" at "${company}".
    The tone should be confident but humble, suitable for an Indian fresher.
    Focus on how the candidate's existing skills (found in the resume) solve specific problems for ${company}.
    Keep it under 300 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "Failed to generate cover letter.";
  } catch (error) {
    console.error("Cover letter generation error:", error);
    return "Error generating cover letter. Please try again.";
  }
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

export async function generateInterviewFeedback(
  question: string, 
  answer: string | { data: string; mimeType: string }
): Promise<InterviewFeedbackResponse> {
  const isAudio = typeof answer !== "string";
  const prompt = `
    Analyze this interview answer for the question: "${question}"
    ${isAudio ? "The user provided an audio recording. Please transcribe it first and then analyze." : `User's Answer: "${answer}"`}
    
    1. Evaluate if it follows the STAR (Situation, Task, Action, Result) structure.
    2. Check confidence based on vocabulary, tone, and directness.
    3. Identify key industry keywords used or missing.
    4. Provide a "Confidence Score" (0-100).
    5. Provide a "Suggested Answer" (A better way to say it - "Try Saying This").
    6. If it's audio, mention "Filler Words" (um, uh, like) in the analysis.
    
    Provide feedback in JSON format:
    {
      "transcript": "Full transcription if audio, otherwise the user's answer text",
      "confidenceScore": number,
      "confidenceAnalysis": "Analysis of the tone and certainty",
      "clarity": "How well the point was communicated",
      "keywords": "Are there industry-standard keywords used?",
      "starStructure": boolean (True if STAR components are present),
      "strengths": string[] (Exactly 3 strengths),
      "blindSpots": string[] (Exactly 2 blind spots),
      "suggestedAnswer": "A professional version of the user's answer",
      "overall": "One sentence improvement tip"
    }
  `;

  const contents = isAudio ? [
    {
      parts: [
        { inlineData: { data: answer.data, mimeType: answer.mimeType } },
        { text: prompt }
      ]
    }
  ] : [
    {
      parts: [{ text: prompt }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents as any,
      config: { responseMimeType: "application/json" }
    });
    const sanitizedText = sanitizeJSON(response.text || "{}");
    return JSON.parse(sanitizedText);
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
      overall: "Error analyzing answer." 
    };
  }
}

export async function auditStory(story: string): Promise<{ audit: string; hasResult: boolean; suggestion: string }> {
  const prompt = `
    Analyze this professional project story:
    STORY: "${story}"
    
    1. Audit for a "Measurable Result" (e.g., "Increased efficiency by 20%", "Saved ₹50k").
    2. Provide a short audit summary.
    3. If a measurable result is missing, suggest a specific way to quantify the achievement.
    
    Return JSON:
    {
      "audit": "Summary of the audit",
      "hasResult": boolean,
      "suggestion": "Quantification tip"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const sanitizedText = sanitizeJSON(response.text || "{}");
    return JSON.parse(sanitizedText);
  } catch (error) {
    console.error("Story audit error:", error);
    return { audit: "Error auditing", hasResult: false, suggestion: "Try adding numbers." };
  }
}

export async function getNegotiationAdvice(query: string): Promise<string> {
  const prompt = `
    You are a professional Negotiation Coach for Indian corporate jobs.
    User asks: "${query}"
    Provide a specific script or strategic advice based on Indian corporate standards for freshers in 2026.
    Keep it actionable and under 150 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });
    return response.text || "I couldn't generate advice at this moment.";
  } catch (error) {
    console.error("Negotiation advice error:", error);
    return "Error generating advice.";
  }
}

export async function analyzeProfiles(resumeText: string, linkedinText: string, naukriText: string): Promise<{
  inconsistencies: string[];
  unifiedIdentity: string;
}> {
  const prompt = `
    Analyze these professional profiles for an Indian fresher:
    Resume: "${resumeText.substring(0, 2000)}"
    LinkedIn: "${linkedinText.substring(0, 2000)}"
    Naukri: "${naukriText.substring(0, 2000)}"
    
    1. Scan for inconsistencies (e.g., date mismatches, different skill focus).
    2. Generate a "Unified Corporate Identity" - a strong, unified professional summary that combines the best points from all platforms.
    
    Return JSON:
    {
      "inconsistencies": string[],
      "unifiedIdentity": string
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const sanitizedText = sanitizeJSON(response.text || "{}");
    return JSON.parse(sanitizedText);
  } catch (error) {
    console.error("Profile analysis error:", error);
    return { inconsistencies: [], unifiedIdentity: "Unified identity generation failed." };
  }
}

export async function autoInjectKeywords(resumeText: string, missingKeywords: string[]): Promise<{
  summary: string;
  skillsSection: string;
  fullImprovedResume: string;
}> {
  const prompt = `
    ACT AS AN EXPERT ATS OPTIMIZER.
    I have a resume and a list of missing keywords for a target role.
    
    RESUME: "${resumeText.substring(0, 4000)}"
    MISSING KEYWORDS: ${missingKeywords.join(", ")}
    
    INSTRUCTIONS:
    1. Rewrite the "Professional Summary" to naturally incorporate at least 3 of these keywords.
    2. Rewrite the "Skills" section to include ALL missing keywords in a way that looks authentic.
    3. Provide the full improved resume with these changes applied.
    
    RETURN JSON:
    {
      "summary": "The rewritten summary",
      "skillsSection": "The updated skills list",
      "fullImprovedResume": "The entire resume text with these injections"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const sanitizedText = sanitizeJSON(response.text || "{}");
    return JSON.parse(sanitizedText);
  } catch (error) {
    console.error("Auto-inject error:", error);
    throw error;
  }
}
