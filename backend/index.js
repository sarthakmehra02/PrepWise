require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { db } = require('./firebase');

const app  = express();
const port = process.env.PORT || 5000;

// ----------------------------------------------------------------
// CORS – allow only the known frontend origins
// ----------------------------------------------------------------
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
app.use(cors({
  origin: (origin, cb) => {
    // allow server-to-server calls (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ----------------------------------------------------------------
// Llama 3.3 70B via NVIDIA NIM (OpenAI-compatible endpoint)
// ----------------------------------------------------------------
const nvidia = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey:  process.env.NVIDIA_API_KEY,
});
const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

// ----------------------------------------------------------------
// callNvidiaRaw — direct HTTP to NVIDIA, avoids SDK JSON-parse bug
// Includes retry logic for transient ECONNRESET / network errors.
// ----------------------------------------------------------------
async function callNvidiaRaw(prompt, maxTokens = 2048) {
  const nodeFetch = require('node-fetch');
  const AbortController = require('abort-controller');

  const MAX_RETRIES = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

    try {
      console.log(`[nvidia] Attempt ${attempt}/${MAX_RETRIES}...`);
      const response = await nodeFetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: maxTokens,
        }),
      });

      // Get raw text — do NOT call response.json() (fails on unescaped backslashes)
      let rawText = await response.text();

      // Sanitize: replace backslashes NOT part of a valid JSON escape with double-backslash
      rawText = rawText.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        throw new Error(`NVIDIA API returned unparseable response: ${e.message}`);
      }

      const content = parsed?.choices?.[0]?.message?.content;
      if (!content) throw new Error('NVIDIA API returned empty content.');
      return content;

    } catch (err) {
      lastError = err;
      const isTransient = err.code === 'ECONNRESET' || err.name === 'AbortError' || err.code === 'ECONNREFUSED';
      console.warn(`[nvidia] Attempt ${attempt} failed: ${err.message}`);
      if (isTransient && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000)); // wait 2s before retry
      } else {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

// ----------------------------------------------------------------
// Health check
// ----------------------------------------------------------------
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'Prep Wise API' }));


// ================================================================
//  TWO-ASSISTANT SYSTEM — OVERVIEW
// ================================================================
//
//  ┌─────────────────────────────────────────────────────────────┐
//  │  FLOW A – Predefined Role                                   │
//  │                                                             │
//  │  Frontend  ──POST /api/vapi/generate──▶  Backend           │
//  │              { role, experience, techStack, userId }        │
//  │                          │                                  │
//  │              Gemini generates 5 questions                   │
//  │                          │                                  │
//  │  Frontend  ◀── { success, questions, variableValues } ──── │
//  │                          │                                  │
//  │  vapi.start(INTERVIEWER_ID, { variableValues })            │
//  └─────────────────────────────────────────────────────────────┘
//
//  ┌─────────────────────────────────────────────────────────────┐
//  │  FLOW B – Custom Interview                                  │
//  │                                                             │
//  │  Frontend  ──▶  vapi.start(COLLECTOR_ID)                   │
//  │                                                             │
//  │  Collector agent has voice conversation, collects:         │
//  │    role | experience | techStack                           │
//  │                                                             │
//  │  Collector calls tool → submit_interview_details(...)      │
//  │                                                             │
//  │  OPTION A (client-side):                                   │
//  │    vapi.on('message') → tool-calls event → frontend        │
//  │    → POST /api/vapi/generate → same as Flow A above        │
//  │                                                             │
//  │  OPTION B (server-side webhook – Vapi Dashboard URL):      │
//  │    Vapi → POST /api/vapi/collector-webhook                  │
//  │    Backend saves data, returns { result: "data stored" }   │
//  │    Frontend polls or listens for call-end, fetches result  │
//  └─────────────────────────────────────────────────────────────┘
// ================================================================

// ----------------------------------------------------------------
// HELPER - build Gemini prompt (with optional resume keyword analysis)
// ----------------------------------------------------------------
function buildGeminiPrompt(role, experience, techStack, resumeContent = null) {
  // -- WITH RESUME: hybrid keyword-analysis + role-knowledge approach
  if (resumeContent) {
    // Increased limit to 20,000 to easily fit modern resumes + extracted hyperlinks
    const truncated = resumeContent.slice(0, 20000);
    return `You are a senior technical interviewer designing a rigorous 8-minute interview.

Position  : ${role}
Level     : ${experience}
Tech Stack: ${techStack}

Candidate Resume:
---
${truncated}
---

TASK: Generate EXACTLY 8 interview questions in STRICTLY ALTERNATING order:

STEP 1 - KEYWORD ANALYSIS (internal only, do not output):
  Scan the resume and identify ONLY projects, skills, and experience containing
  keywords directly relevant to the "${role}" role.
  Examples by role:
    - AI/ML Engineer: machine learning, neural networks, NLP, computer vision,
      TensorFlow, PyTorch, model training, data pipelines, scikit-learn, LLM, etc.
    - Full Stack Dev: React, Node.js, REST APIs, databases, frontend/backend projects.
    - DevOps/SRE: Docker, Kubernetes, CI/CD, Linux, cloud, infrastructure.
    - Data Analyst: SQL, Python, Tableau, Excel, dashboards, data cleaning.
  IGNORE experience not relevant to the ${role} role entirely.

STEP 2 - GENERATE 8 QUESTIONS in ALTERNATING order (STRICTLY follow this pattern):
  Q1: ROLE KNOWLEDGE — standard ${experience}-level ${role} technical question
  Q2: RESUME-SPECIFIC — about a ${role}-relevant project/skill from the resume
  Q3: ROLE KNOWLEDGE
  Q4: RESUME-SPECIFIC
  Q5: ROLE KNOWLEDGE
  Q6: RESUME-SPECIFIC
  Q7: ROLE KNOWLEDGE
  Q8: RESUME-SPECIFIC (if fewer resume items exist, use another ROLE KNOWLEDGE)

  ROLE KNOWLEDGE: Focus on architecture, trade-offs, debugging, system design, real-world problem-solving.
  RESUME-SPECIFIC: Reference the project/skill/technology by name. *CRITICAL: If you see [EXTRACTED LINKS] or [LINKS] at the bottom of the resume (e.g., GitHub, Portfolio, LinkedIn), you MUST generate at least one question asking them to explain the architecture or challenges of a project visible on that profile.*

RULES:
  - Do NOT label or separate questions by type in the output — output them blended.
  - Avoid simple definition questions — prefer how, why, what would you do.
  - Do not repeat the same project, concept, or technology twice.

OUTPUT FORMAT (STRICT):
Return ONLY a valid JSON array of 8 strings. No markdown, no labels, no preamble.
`;
  }

  // -- WITHOUT RESUME: role-only questions
  return `You are a senior technical interviewer designing a rigorous 8-minute interview.

Position  : ${role}
Level     : ${experience}
Tech Stack: ${techStack}

Task: Generate EXACTLY 8 challenging, highly relevant technical interview questions.
Focus on:
  - Real-world implementation problems
  - Architecture decisions and trade-offs
  - Debugging and problem-solving within the specified tech stack
  - Avoid simple definition questions - prefer how, why, and what would you do questions

OUTPUT FORMAT (STRICT):
Return ONLY a valid JSON array of 8 strings. No markdown code fences, no explanations, no preamble.
`;
}


// ----------------------------------------------------------------
// HELPER – parse Gemini response robustly
// ----------------------------------------------------------------
function parseQuestions(rawText) {
  // Attempt 1: direct parse
  try {
    const parsed = JSON.parse(rawText.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  // Attempt 2: strip markdown fences
  const stripped = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
  return parsed;
}

// ================================================================
//  ROUTE 1 – POST /api/vapi/generate
//  Called by the frontend (both Predefined and Custom flows).
//  Generates questions via Gemini and returns them along with
//  pre-formatted variableValues ready for vapi.start() override.
// ================================================================
app.post('/api/vapi/generate', async (req, res) => {
  const { role, experience, techStack, resumeContent, userId } = req.body;
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[generate:${requestId}] --- START ---`);
  console.log(`[generate:${requestId}] Role: ${role} | Exp: ${experience} | Tech: ${techStack}`);
  console.log(`[generate:${requestId}] Resume: ${resumeContent ? 'Yes (' + resumeContent.length + ' chars)' : 'No'}`);

  if (!role || !experience || !techStack) {
    console.warn(`[generate:${requestId}] Error: Missing required fields`);
    return res.status(400).json({
      error: 'Missing required fields: role, experience, techStack',
    });
  }

  try {
    console.log(`[generate:${requestId}] STEP 1: Calling NVIDIA AI (${NVIDIA_MODEL})...`);
    const startTime = Date.now();
    const result = await generateText({
      model: nvidia.chat(NVIDIA_MODEL),
      prompt: buildGeminiPrompt(role, experience, techStack,
        (resumeContent && resumeContent.trim().length > 50) ? resumeContent : null),
    });
    console.log(`[generate:${requestId}] STEP 2: AI response received in ${Date.now() - startTime}ms`);

    console.log(`[generate:${requestId}] STEP 3: Parsing questions...`);
    const questions = parseQuestions(result.text);
    console.log(`[generate:${requestId}] STEP 4: Successfully parsed ${questions.length} questions`);

    const formattedQuestions = questions
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');

    if (db && userId) {
      console.log(`[generate:${requestId}] STEP 5: Persisting to Firestore...`);
      await db.collection('interviews').add({
        userId, role, experience, techStack, questions,
        source: 'generate', createdAt: new Date().toISOString(),
      });
    }

    console.log(`[generate:${requestId}] --- SUCCESS --- Returning response`);
    return res.status(200).json({
      success: true,
      questions,
      variableValues: { role, experience, questions: formattedQuestions },
    });

  } catch (err) {
    console.error(`[generate:${requestId}] !!! ERROR !!!`, err.message);
    return res.status(500).json({ error: 'Failed to generate interview questions: ' + err.message });
  }
});

// ================================================================
//  ROUTE 2 – POST /api/vapi/collector-webhook
//  (OPTIONAL — server-side alternative to client-side tool handling)
//
//  Configure this URL in the Vapi Dashboard as the server URL for
//  the Collector assistant's submit_interview_details tool.
//  Vapi will POST here when the Collector calls the tool.
//
//  Payload from Vapi:
//  {
//    message: {
//      type: "tool-calls",
//      toolCallList: [{
//        function: { name: "submit_interview_details", arguments: { role, experience, techStack } }
//      }],
//      call: { id: "<call-id>" }
//    }
//  }
// ================================================================
app.post('/api/vapi/collector-webhook', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[collector-webhook:${requestId}] --- START ---`);
  try {
    const message  = req.body?.message;
    const toolCall = message?.toolCallList?.find(
      t => t.function?.name === 'submit_interview_details'
    );

    if (!toolCall) {
      console.warn(`[collector-webhook:${requestId}] Error: No tool call in payload`);
      return res.status(400).json({ error: 'No submit_interview_details tool call found' });
    }

    let args = toolCall.function.arguments;
    if (typeof args === 'string') args = JSON.parse(args);
    const { role, experience, techStack } = args;
    const callId = message?.call?.id || null;

    console.log(`[collector-webhook:${requestId}] Data: ${role}, ${experience}, ${techStack}`);
    console.log(`[collector-webhook:${requestId}] STEP 1: Calling AI for questions...`);
    
    const result    = await generateText({
      model: nvidia.chat(NVIDIA_MODEL),
      prompt: buildGeminiPrompt(role, experience, techStack),
    });
    const questions = parseQuestions(result.text);
    console.log(`[collector-webhook:${requestId}] STEP 2: Generated ${questions.length} questions`);

    const formattedQuestions = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    if (db && callId) {
      console.log(`[collector-webhook:${requestId}] STEP 3: Saving session ${callId}...`);
      await db.collection('collector_sessions').doc(callId).set({
        role, experience, techStack, questions,
        createdAt: new Date().toISOString(),
      });
    }

    console.log(`[collector-webhook:${requestId}] --- SUCCESS --- Returning Vapi Tool result`);
    return res.status(200).json({
      results: [{
        toolCallId: toolCall.id,
        result: 'Details collected successfully. Transferring to Interviewer.',
      }],
      data: {
        success: true,
        questions,
        variableValues: { role, experience, questions: formattedQuestions },
      },
    });

  } catch (err) {
    console.error(`[collector-webhook:${requestId}] !!! ERROR !!!`, err.message);
    return res.status(500).json({ error: 'Collector webhook failed' });
  }
});

// ================================================================
//  ROUTE 2b – POST /api/vapi/generate-from-content
//  Accepts raw text (resume, JD) + optional role context.
// ================================================================
app.post('/api/vapi/generate-from-content', async (req, res) => {
  const { content, role, experience, techStack, userId } = req.body;
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[generate-from-content:${requestId}] --- START ---`);
  
  if (!content || content.trim().length < 50) {
    console.warn(`[generate-from-content:${requestId}] Error: Document content too short`);
    return res.status(400).json({ error: 'Document content is too short or missing.' });
  }

  const truncated = content.slice(0, 5000);
  const roleCtx   = role ? `\nRole: ${role}\nLevel: ${experience || 'General'}\nTech: ${techStack || 'General'}` : '';
  const prompt = `You are a senior technical interviewer.${roleCtx}\n\nA candidate provided the following document:\n---\n${truncated}\n---\nGenerate EXACTLY 7 highly relevant, challenging interview questions based on this document${role ? ' and the role' : ''}.\nFocus on specific skills, projects, and technologies mentioned. Avoid generic questions.\nReturn ONLY a valid JSON array of 7 strings. No markdown, no preamble.`;

  const displayRole = role || 'Document-based Interview';
  console.log(`[generate-from-content:${requestId}] Role: ${displayRole} | Content Len: ${content.length}`);

  try {
    console.log(`[generate-from-content:${requestId}] STEP 1: Calling NVIDIA AI (${NVIDIA_MODEL})...`);
    const startTime = Date.now();
    const result    = await generateText({ model: nvidia.chat(NVIDIA_MODEL), prompt });
    console.log(`[generate-from-content:${requestId}] STEP 2: AI response received in ${Date.now() - startTime}ms`);
    
    console.log(`[generate-from-content:${requestId}] STEP 3: Parsing questions...`);
    const questions = parseQuestions(result.text);
    console.log(`[generate-from-content:${requestId}] STEP 4: Successfully parsed ${questions.length} questions`);
    
    const formatted = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    
    if (db && userId) {
      console.log(`[generate-from-content:${requestId}] STEP 5: Saving to Firestore...`);
      await db.collection('interviews').add({ userId, source: 'document', role: displayRole, questions, createdAt: new Date().toISOString() });
    }
    
    console.log(`[generate-from-content:${requestId}] --- SUCCESS --- Returning response`);
    return res.status(200).json({ success: true, questions, variableValues: { role: displayRole, experience: experience || 'General', questions: formatted } });
  } catch (err) {
    console.error(`[generate-from-content:${requestId}] !!! ERROR !!!`, err.message);
    return res.status(500).json({ error: 'Failed to generate questions from document.' });
  }
});

// ================================================================
//  ROUTE 2c - POST /api/resume/analyze
//  Evaluates a resume with optional job context for tailored scoring
// ================================================================
app.post('/api/resume/analyze', async (req, res) => {
  const { resumeText, jobDescription, targetRole, experience, industry } = req.body;
  if (!resumeText || resumeText.trim().length < 100) {
    return res.status(400).json({ error: 'Resume text is too short or missing' });
  }

  const truncated = resumeText.slice(0, 8000);
  
  // Build context section based on what was provided
  let contextSection = '';
  if (jobDescription) {
    contextSection = `
The candidate is applying for a position. Here is the Job Description to evaluate against:
--- JOB DESCRIPTION ---
${jobDescription.slice(0, 3000)}
--- END JOB DESCRIPTION ---
Score the resume based on how well it matches this specific job description.`;
  } else if (targetRole) {
    contextSection = `
The candidate is targeting the role of: ${targetRole}
Experience level: ${experience || 'Not specified'}
Industry: ${industry || 'General Technology'}
Score the resume based on how well it suits this specific role and experience level.`;
  }

  const prompt = `You are a strictly critical ATS algorithm and a highly aggressive senior technical recruiter.
${contextSection}

CRITICAL INSTRUCTION: Be ruthlessly strict. If the candidate's projects or tech stack do not strongly align with the target role (e.g. they have Frontend projects but are applying for AI/ML or Backend), you MUST give an extremely low score (e.g. 10-30). Provide harsh, direct, and unforgiving feedback about their lack of relevant experience.

Analyze the following resume text and provide your response strictly in JSON format:
{
  "score": <number 0-100: ATS compatibility + role fit if context provided>,
  "roleMatch": "<one sentence summarizing how well the resume matches the target role/JD>",
  "strengths": [<array of 3-5 specific strengths found in the resume>],
  "weaknesses": [<array of 3-5 specific gaps or missing elements>],
  "suggestions": [<array of 5-7 concrete, actionable improvement suggestions tailored to the context>],
  "keywords": {
    "present": [<list of relevant keywords/skills found in the resume>],
    "missing": [<list of important keywords/skills missing from the resume, based on the role or JD>]
  }
}

Resume Text:
---
${truncated}
---
Return ONLY valid JSON. No markdown. No preamble.`;

  try {
    const result = await generateText({ model: nvidia.chat(NVIDIA_MODEL), prompt });
    let raw = result.text.trim();
    // More robust stripping: find first { and last }
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      raw = raw.substring(firstBrace, lastBrace + 1);
    }
    const analysis = JSON.parse(raw);
    return res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('[resume-analyze]', err.message);
    return res.status(500).json({ error: 'Failed to analyze resume.' });
  }
});


// ================================================================
//  ROUTE 2c3 - POST /api/resume/parse
//  Parses raw resume text into structured JSON blocks for the Visual Editor
// ================================================================
app.post('/api/resume/parse', async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText) return res.status(400).json({ error: 'No resume text provided' });

  // ── URL regex extraction (runs before AI, used to fill in AI gaps) ──
  const extractUrls = (text) => {
    const linkedin  = text.match(/(?:linkedin\.com\/in\/[\w\-]+)/i);
    const github    = text.match(/(?:github\.com\/[\w\-]+(?:\/[\w\-]+)?)/i);
    const email     = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i);
    const phone     = text.match(/(?:\+?1[\s.-]?)?(?:\(?[2-9]\d{2}\)?[\s.-]?)?[2-9]\d{2}[\s.-]?\d{4}/i);
    // Portfolio: any URL that's not linkedin/github/email
    const urlPattern = /https?:\/\/(?!(?:www\.)?(?:linkedin|github))[\w\-]+(\.[\w\-]+)+(?:\/[^\s]*)*/gi;
    const allUrls = [...(text.match(urlPattern) || [])];
    const portfolio = allUrls.find(u => !u.includes('linkedin') && !u.includes('github') && !u.includes('mailto'));
    return {
      linkedin:  linkedin  ? linkedin[0]  : null,
      github:    github    ? github[0]    : null,
      email:     email     ? email[0]     : null,
      phone:     phone     ? phone[0]     : null,
      portfolio: portfolio ? portfolio    : null,
    };
  };

  const regexUrls = extractUrls(resumeText);
  console.log('[resume-parse] Regex-extracted URLs:', regexUrls);

  const prompt = `You are an expert resume parser. Extract ALL information from the following resume text and format it into structured JSON.

Divide the resume into these sections: contact, education, experience, projects, skills, and customSections.

For 'contact', extract:
  - name (string): full name, usually the first line of the resume
  - email (string): email address
  - phone (string): phone number with area code
  - linkedin (string): LinkedIn URL or path like linkedin.com/in/username
  - github (string): GitHub URL or path like github.com/username
  - portfolio (string): any other personal website URL

For 'experience', each item MUST have ALL of:
  - company: name of the company or organization
  - role: job title or internship title
  - duration: date range (e.g. "Jun 2023 - Aug 2023" or "Jan 2022 - Present")
  - location: city/state or "Remote" if mentioned, or empty string
  - points: array of bullet point strings describing what was done

For 'projects', each item should have: name, techStack (string of comma-separated technologies), link (full URL if a GitHub/demo link is mentioned), and points (array of strings).
For 'education', each item should have: institution, degree, date, gpa (if present, otherwise empty string).
For 'skills', return an array of strings, each string being a category with its skills (e.g. "Languages: Python, Java, C++").
For 'customSections', if there are additional sections like Certifications, Awards, Publications, etc., include them as array objects with 'title' (string) and 'items' (array of strings).

IMPORTANT:
- Do NOT omit any field. Use empty string "" or empty array [] if not found.
- For links in projects, look for text like "github.com/user/repo" or "demo:" followed by a URL.
- Extract the ACTUAL URL text visible in the resume, not a description.

Resume Text:
---
${resumeText.slice(0, 8000)}
---

Return ONLY valid JSON. No markdown formatting. No preamble.`;

  try {
    const result = await generateText({ model: nvidia.chat(NVIDIA_MODEL), prompt });
    let raw = result.text.trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace  = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) raw = raw.substring(firstBrace, lastBrace + 1);
    const blocks = JSON.parse(raw);

    // ── Post-process: fill in missing contact links with regex results ──
    if (!blocks.contact) blocks.contact = {};
    if (!blocks.contact.linkedin  && regexUrls.linkedin)  blocks.contact.linkedin  = regexUrls.linkedin;
    if (!blocks.contact.github    && regexUrls.github)    blocks.contact.github    = regexUrls.github;
    if (!blocks.contact.email     && regexUrls.email)     blocks.contact.email     = regexUrls.email;
    if (!blocks.contact.phone     && regexUrls.phone)     blocks.contact.phone     = regexUrls.phone;
    if (!blocks.contact.portfolio && regexUrls.portfolio) blocks.contact.portfolio = regexUrls.portfolio;

    console.log('[resume-parse] Final contact:', blocks.contact);
    return res.status(200).json({ success: true, blocks });
  } catch (err) {
    console.error('[resume-parse]', err.message);
    return res.status(500).json({ error: 'Failed to parse resume into blocks.' });
  }
});

// ================================================================
//  ROUTE 2c4 - POST /api/resume/generate-latex
//  Deterministic JS template builder — no AI, always produces valid LaTeX
// ================================================================

// Escape special LaTeX characters
const escLaTeX = (s) => {
  if (!s) return '';
  return String(s)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
};

const buildLatexFromBlocks = (blocks) => {
  const {
    contact = {},
    education = [],
    experience = [],
    projects = [],
    skills = [],
    customSections = [],
  } = blocks;

  // Build contact header line
  const contactParts = [];
  if (contact.email)     contactParts.push(escLaTeX(contact.email));
  if (contact.phone)     contactParts.push(escLaTeX(contact.phone));
  if (contact.linkedin)  {
    const raw = contact.linkedin.replace(/^https?:\/\//i, '');
    const url = contact.linkedin.startsWith('http') ? contact.linkedin : `https://${contact.linkedin}`;
    contactParts.push(`\\href{${url}}{${escLaTeX(raw)}}`);
  }
  if (contact.github) {
    const raw = contact.github.replace(/^https?:\/\//i, '');
    const url = contact.github.startsWith('http') ? contact.github : `https://${contact.github}`;
    contactParts.push(`\\href{${url}}{${escLaTeX(raw)}}`);
  }
  if (contact.portfolio) {
    const raw = contact.portfolio.replace(/^https?:\/\//i, '');
    const url = contact.portfolio.startsWith('http') ? contact.portfolio : `https://${contact.portfolio}`;
    contactParts.push(`\\href{${url}}{${escLaTeX(raw)}}`);
  }

  let doc = `\\documentclass[10pt, letterpaper]{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=2pt}
\\setlength{\\parindent}{0pt}

\\begin{document}
\\pagestyle{empty}

\\begin{center}
    {\\Huge \\textbf{${escLaTeX(contact.name || 'Your Name')}}} \\\\
    \\vspace{2mm}
    \\small ${contactParts.join(' $\\cdot$ ') || ''}
\\end{center}

`;

  // Education
  if (education.length > 0) {
    doc += `\\noindent{\\Large \\textbf{Education}} \\vspace{1mm} \\hrule \\vspace{2mm}\n`;
    education.forEach(edu => {
      doc += `\\textbf{${escLaTeX(edu.institution || '')}} \\hfill \\textit{${escLaTeX(edu.date || '')}}\\\\\n`;
      doc += `${escLaTeX(edu.degree || '')}${edu.gpa ? ` \\hfill GPA: ${escLaTeX(edu.gpa)}` : ''}\n\n`;
    });
  }

  // Experience
  if (experience.length > 0) {
    doc += `\\vspace{4mm}\n\\noindent{\\Large \\textbf{Experience}} \\vspace{1mm} \\hrule \\vspace{2mm}\n`;
    experience.forEach((exp, i) => {
      const duration = escLaTeX(exp.duration || exp.date || '');
      const location = exp.location ? ` -- ${escLaTeX(exp.location)}` : '';
      doc += `\\textbf{${escLaTeX(exp.role || '')}} $\\cdot$ \\textit{${escLaTeX(exp.company || '')}} \\hfill \\textit{${duration}${location}}\n`;
      const pts = (exp.points || []).filter(p => p && p.trim());
      if (pts.length > 0) {
        doc += `\\begin{itemize}\n`;
        pts.forEach(p => { doc += `    \\item ${escLaTeX(p)}\n`; });
        doc += `\\end{itemize}\n`;
      }
      if (i < experience.length - 1) doc += `\\vspace{3mm}\n`;
    });
  }

  // Projects
  if (projects.length > 0) {
    doc += `\n\\vspace{4mm}\n\\noindent{\\Large \\textbf{Projects}} \\vspace{1mm} \\hrule \\vspace{2mm}\n`;
    projects.forEach(proj => {
      const name = escLaTeX(proj.name || '');
      const nameCell = proj.link
        ? `\\href{${proj.link}}{${name}}`
        : name;
      const tech = proj.techStack ? ` $\\cdot$ \\textit{${escLaTeX(proj.techStack)}}` : '';
      doc += `\\textbf{${nameCell}}${tech}\n`;
      const pts = (proj.points || []).filter(p => p && p.trim());
      if (pts.length > 0) {
        doc += `\\begin{itemize}\n`;
        pts.forEach(p => { doc += `    \\item ${escLaTeX(p)}\n`; });
        doc += `\\end{itemize}\n`;
      }
    });
  }

  // Skills
  if (skills && skills.length > 0) {
    doc += `\n\\vspace{4mm}\n\\noindent{\\Large \\textbf{Skills}} \\vspace{1mm} \\hrule \\vspace{2mm}\n`;
    const skillLines = Array.isArray(skills) ? skills : [skills];
    skillLines.forEach(line => {
      if (line && line.trim()) doc += `${escLaTeX(line)} \\\\\n`;
    });
  }

  // Custom Sections
  if (customSections && customSections.length > 0) {
    customSections.forEach(section => {
      if (!section.title || !section.items || section.items.length === 0) return;
      doc += `\n\\vspace{4mm}\n\\noindent{\\Large \\textbf{${escLaTeX(section.title)}}} \\vspace{1mm} \\hrule \\vspace{2mm}\n`;
      doc += `\\begin{itemize}\n`;
      section.items.forEach(item => { if (item && item.trim()) doc += `    \\item ${escLaTeX(item)}\n`; });
      doc += `\\end{itemize}\n`;
    });
  }

  doc += `\n\\end{document}\n`;
  return doc;
};

app.post('/api/resume/generate-latex', (req, res) => {
  const { blocks } = req.body;
  if (!blocks) return res.status(400).json({ error: 'No blocks provided' });
  try {
    const latex = buildLatexFromBlocks(blocks);
    console.log('[generate-latex] Built deterministically, length:', latex.length);
    return res.status(200).json({ success: true, latex });
  } catch (err) {
    console.error('[resume-generate-latex]', err.message);
    return res.status(500).json({ error: 'Failed to generate LaTeX from blocks.' });
  }
});

// ================================================================
//  ROUTE 2d - POST /api/resume/compile-latex
//  Compiles LaTeX code to PDF using texlive.net cloud API
// ================================================================
const FormData = require('form-data');
const fetch = require('node-fetch');

app.post('/api/resume/compile-latex', async (req, res) => {
  const { latex } = req.body;
  if (!latex || typeof latex !== 'string' || latex.trim().length === 0) {
    return res.status(400).json({ error: 'No LaTeX code provided or code is empty.' });
  }

  console.log(`[latex-compile] Compiling LaTeX doc, length=${latex.length}`);

  try {
    const form = new FormData();
    form.append('filecontents[]', latex);
    form.append('filename[]', 'document.tex');
    form.append('engine', 'pdflatex');
    form.append('return', 'pdf');

    const response = await fetch('https://texlive.net/cgi-bin/latexcgi', {
      method: 'POST',
      body: form,
      headers: form.getHeaders ? form.getHeaders() : {},
    });

    const contentType = response.headers.get('content-type') || '';
    console.log(`[latex-compile] Response status=${response.status} content-type=${contentType}`);

    if (contentType.includes('application/pdf')) {
      const buffer = await response.buffer();
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="resume.pdf"',
        'Content-Length': buffer.length,
      });
      return res.send(buffer);
    } else {
      // Compilation failed — returned logs as text/html or text/plain
      const text = await response.text();
      console.error('[latex-compile] Compilation error logs:', text.slice(0, 800));
      // Try to extract a meaningful error from the log
      const errorMatch = text.match(/!\s+(.+)/m);
      const errorMsg = errorMatch ? errorMatch[1] : 'LaTeX compilation failed. Check your syntax.';
      return res.status(400).json({ error: errorMsg, logs: text.slice(0, 2000) });
    }
  } catch (err) {
    console.error('[latex-compile]', err.message);
    return res.status(500).json({ error: `Failed to reach LaTeX compilation server: ${err.message}` });
  }
});

// ================================================================
// ================================================================
//  ROUTE 2e - POST /api/resume/chat
//  AI Resume Coach — patch-based (AI returns ONLY changed fields, tiny response)
// ================================================================
app.post('/api/resume/chat', async (req, res) => {
  const { messages, blocks } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No chat messages provided.' });
  }
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) {
    return res.status(400).json({ error: 'No user message found.' });
  }

  const contact    = blocks?.contact        || {};
  const experience = blocks?.experience     || [];
  const projects   = blocks?.projects       || [];
  const education  = blocks?.education      || [];
  const skills     = blocks?.skills         || '';
  const custom     = blocks?.customSections || [];

  const hasBlocks = contact.name || experience.length || education.length || projects.length;

  // Compact summary — trim bullets to save prompt tokens
  const resumeSummary = hasBlocks ? [
    `NAME: ${contact.name || ''} | EMAIL: ${contact.email || ''} | PHONE: ${contact.phone || ''}`,
    `LINKEDIN: ${contact.linkedin || ''} | GITHUB: ${contact.github || ''} | PORTFOLIO: ${contact.portfolio || ''}`,
    education.length ? `EDUCATION: ${education.map(e => `${e.institution} (${e.degree}, ${e.date}, GPA:${e.gpa})`).join('; ')}` : '',
    experience.length ? `EXPERIENCE:\n${experience.map((e, i) =>
      `  [${i}] ${e.role} @ ${e.company} (${e.duration || e.date || ''}):\n${(e.points || []).map(p => `      - ${p}`).join('\n')}`
    ).join('\n')}` : '',
    projects.length ? `PROJECTS:\n${projects.map((p, i) =>
      `  [${i}] ${p.name} (${p.techStack || ''})${p.link ? ' link:' + p.link : ''}:\n${(p.points || []).map(pt => `      - ${pt}`).join('\n')}`
    ).join('\n')}` : '',
    `SKILLS: ${Array.isArray(skills) ? skills.join(', ') : skills}`,
    custom.length ? `CUSTOM: ${custom.map(s => s.title).join(', ')}` : '',
  ].filter(Boolean).join('\n') : '(empty resume)';

  const userRequest = lastUserMessage.content;

  // PATCH approach: AI returns only the fields that changed → tiny response → no ECONNRESET
  const prompt = `You are a surgical resume editor. Make ONLY the exact change the user asked for — nothing else.

Resume data (indexed for reference):
${resumeSummary}

User request: "${userRequest}"

CRITICAL RULES — VIOLATING THESE IS A BUG:
1. ONLY modify the exact section(s) and item(s) the user explicitly mentioned.
2. If the user says "remove project [X]", delete ONLY project [X]. Keep all other projects EXACTLY as-is, including their names, tech stacks, and every bullet point word-for-word.
3. If the user says "change the summary", touch ONLY the summary field. Do NOT alter experience bullets, project descriptions, or any other field.
4. If the user says "rewrite bullet X in experience Y", change ONLY that bullet. Every other experience, project, education, and skill stays VERBATIM unchanged.
5. NEVER rewrite, rephrase, improve, or "enhance" any content the user did NOT explicitly ask to change.
6. When returning arrays (experience, projects, etc.), include ALL existing items — only modified items may differ from the original; the rest must be copied EXACTLY as provided above.

Return ONLY a JSON object with this exact shape (no markdown, no extra text):
{"reply":"<1 sentence confirming exactly what was changed>","patch":<null if nothing to change, or an object with ONLY the top-level sections that changed>}

Patch rules:
- patch keys can be: contact, education, experience, projects, skills, customSections
- contact: {name,email,phone,linkedin,github,portfolio}
- education: full array of {institution,degree,date,gpa}
- experience: full array of {company,role,duration,location,points:[strings]}
- projects: full array of {name,techStack,link,points:[strings]}
- skills: plain comma-separated string
- customSections: array of {title,items:[strings]}
- ONLY include sections that actually changed. Omit unchanged sections entirely.
- Plain text only. No LaTeX. No backslashes.`;

  console.log(`[resume-chat] User: "${userRequest.slice(0, 60)}" | hasBlocks: ${!!hasBlocks}`);

  try {
    let raw = await callNvidiaRaw(prompt, 2048); // larger limit for full bullets in context
    raw = raw.trim();

    // Strip markdown fences
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // Extract JSON object
    const firstBrace = raw.indexOf('{');
    const lastBrace  = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      raw = raw.substring(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonErr) {
      console.error('[resume-chat] JSON parse failed:', jsonErr.message);
      return res.status(200).json({
        success: true,
        reply: "I understood your request but had trouble formatting my response. Please try rephrasing.",
        updatedBlocks: null
      });
    }

    const reply = parsed.reply || 'Done!';
    const patch = parsed.patch || null;

    // Deep-merge patch into existing blocks (only changed sections replace existing)
    let updatedBlocks = null;
    if (patch && blocks) {
      updatedBlocks = {
        contact:        patch.contact        || blocks.contact        || {},
        education:      patch.education      || blocks.education      || [],
        experience:     patch.experience     || blocks.experience     || [],
        projects:       patch.projects       || blocks.projects       || [],
        skills:         patch.skills         !== undefined ? patch.skills : (blocks.skills || ''),
        customSections: patch.customSections || blocks.customSections || [],
      };
    }

    console.log(`[resume-chat] Reply: "${reply.slice(0, 60)}" | Patch keys: ${patch ? Object.keys(patch).join(',') : 'none'}`);
    return res.status(200).json({ success: true, reply, updatedBlocks });

  } catch (err) {
    console.error('[resume-chat] ERROR:', err.message);
    return res.status(500).json({ error: `Chat failed: ${err.message}` });
  }
});









// ================================================================
// ================================================================
//  ROUTE 3 - POST /api/vapi/feedback

//  Frontend sends the interview transcript; Gemini grades it across
//  5 dimensions and returns scores + written feedback.
// ================================================================
app.post('/api/vapi/feedback', async (req, res) => {
  const { transcript, role, experience, userId } = req.body;

  if (!transcript || transcript.trim().length < 80) {
    return res.status(400).json({ error: 'Transcript too short to grade.' });
  }

  const gradingPrompt = `You are an expert technical interview evaluator. Fairly and rigorously evaluate a candidate's performance in a ${experience || 'General'} level ${role || 'Technical'} interview.

Interview Transcript:
---
${transcript.slice(0, 6000)}
---

Evaluate ONLY the candidate's responses. Score each dimension out of 10 (integers only).

SCORING DIMENSIONS:
1. technicalAccuracy    - Correctness of answers, proper terminology, no factual errors.
2. problemSolving       - Breaks down problems logically, considers edge cases, proposes solutions.
3. communicationClarity - Clear, structured explanations. Concise without rambling.
4. depthOfKnowledge     - Goes beyond surface-level; demonstrates deep understanding.
5. confidence           - Speaks with conviction, avoids excessive hedging.

Also provide:
- strengths: 2-3 specific positive observations.
- improvements: 2-3 specific, actionable areas to work on.
- summary: 2-3 sentence overall performance summary.

Return ONLY this valid JSON, no markdown, no preamble:
{"scores":{"technicalAccuracy":<int>,"problemSolving":<int>,"communicationClarity":<int>,"depthOfKnowledge":<int>,"confidence":<int>},"average":<float>,"strengths":["<str>","<str>"],"improvements":["<str>","<str>"],"summary":"<str>"}
`;

  console.log(`[feedback] Grading ${role} | len: ${transcript.length}`);

  try {
    const result = await generateText({
      model: nvidia.chat(NVIDIA_MODEL),
      prompt: gradingPrompt,
    });

    let feedback;
    try {
      const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      feedback = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON for feedback');

    }

    // Recalculate average server-side for safety
    const scoreValues = Object.values(feedback.scores);
    feedback.average  = parseFloat((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1));

    if (db && userId) {
      await db.collection('feedback').add({
        userId, role, experience,
        scores: feedback.scores,
        average: feedback.average,
        summary: feedback.summary,
        strengths: feedback.strengths,
        improvements: feedback.improvements,
        createdAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({ success: true, feedback });

  } catch (err) {
    console.error('[feedback]', err.message);
    return res.status(500).json({ error: 'Failed to grade interview.' });
  }
});

// Start server
// ----------------------------------------------------------------
const server = // ── FAIL-SAFE: Generate questions from raw collector transcript ──
app.post('/api/vapi/generate-from-transcript', async (req, res) => {
  const { transcript, userId } = req.body;
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[transcript-handoff:${requestId}] --- START ---`);
  
  if (!transcript || transcript.length < 50) {
    console.warn(`[transcript-handoff:${requestId}] Error: Transcript too short`);
    return res.status(400).json({ error: 'Transcript too short to process.' });
  }

  console.log(`[transcript-handoff:${requestId}] STEP 1: Extracting role/skills from transcript...`);
  
  const extractPrompt = `The following is a conversation between an AI Collector and a Candidate.
Extract the "Target Role" and "Primary Technologies/Skills" the candidate mentioned.
Transcript:
---
${transcript}
---
Return ONLY a JSON object with keys "role" and "techStack". No markdown.`;

  try {
    const extractResult = await generateText({ model: nvidia.chat(NVIDIA_MODEL), prompt: extractPrompt });
    let { role, techStack } = { role: 'Software Engineer', techStack: 'General' };
    try {
      const parsed = JSON.parse(extractResult.text.replace(/```json|```/g, ''));
      role = parsed.role || role;
      techStack = parsed.techStack || techStack;
    } catch (e) { console.warn(`[transcript-handoff:${requestId}] Extraction parse failed, using defaults`); }

    console.log(`[transcript-handoff:${requestId}] STEP 2: Custom Agent Data Extracted -> Role: ${role}, Tech: ${techStack}`);
    
    const genPrompt = `You are a senior technical interviewer.
Target Role: ${role}
Tech Stack: ${techStack}
Generate EXACTLY 7 highly relevant, challenging interview questions.
Return ONLY a valid JSON array of 7 strings. No markdown.`;

    console.log(`[transcript-handoff:${requestId}] STEP 3: Requesting questions from AI...`);
    const genResult = await generateText({ model: nvidia.chat(NVIDIA_MODEL), prompt: genPrompt });
    const questions = parseQuestions(genResult.text);
    
    console.log(`[transcript-handoff:${requestId}] STEP 4: Successfully received ${questions.length} questions from AI`);

    const formatted = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    if (db && userId) {
      await db.collection('interviews').add({ userId, source: 'collector-failsafe', role, questions, createdAt: new Date().toISOString() });
    }

    console.log(`[transcript-handoff:${requestId}] --- SUCCESS --- Interview Agent Starting...`);
    return res.status(200).json({ success: true, questions, variableValues: { role, experience: 'General', questions: formatted } });
  } catch (err) {
    console.error(`[transcript-handoff:${requestId}] !!! ERROR !!!`, err.message);
    return res.status(500).json({ error: 'Failed to process transcript.' });
  }
});

// Start server
// ----------------------------------------------------------------
app.listen(port, () => {
  console.log(`\n🚀  Prep Wise API running on port ${port}`);
  console.log(`    NVIDIA key    : ${process.env.NVIDIA_API_KEY ? '✓ loaded' : '⚠ NVIDIA_API_KEY not set'}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${port} is already in use.`);
    console.error(`    Kill the existing process first:`);
    console.error(`    netstat -ano | findstr :${port}  (find the PID)`);
    console.error(`    taskkill /PID <PID> /F\n`);
  } else {
    console.error('\n❌  Server error:', err.message);
  }
  process.exit(1);
});

