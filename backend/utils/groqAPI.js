const Groq = require('groq-sdk');

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const analyzeResumeWithAI = async (resumeText, roleName, roleSkills) => {
  const prompt = `You are an expert technical recruiter and skills assessor.

TASK: Analyze a candidate's resume for the role of: "${roleName}"

RESUME:
${resumeText}

Please analyze this resume and:
1. Identify key skills the candidate has
2. Determine what CRITICAL/CORE skills are essential for a "${roleName}" position (focus on must-haves, not nice-to-haves)
3. Identify which critical skills are missing from this resume
4. Evaluate projects, work experience, and practical expertise demonstrated
5. Calculate a match score (0-100) reflecting overall fit
6. Provide actionable feedback and suggestions

Return ONLY valid JSON (no markdown, no code blocks, just raw JSON):

{
  "skillsFound": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "score": number,
  "feedback": "paragraph about overall fit",
  "suggestions": ["action1", "action2"]
}

IMPORTANT RULES:
- skillsFound: List technologies, languages, frameworks found in resume
- missingSkills: List CRITICAL/CORE skills typically required for a "${roleName}" that are NOT in the resume (not nice-to-haves)
- score: 0-100 reflecting overall candidate fit. Consider:
  * Having critical skills present vs missing
  * Quality and relevance of projects and work experience
  * Years of experience and demonstrated expertise
  * Overall capability to do the job
  * Return natural varied scores: could be 27, 45, 63, 78, 89, 34, 92, etc (not just 0, 25, 50, 75, 100)
- feedback: 2-3 sentences about candidate fit for this role
- suggestions: 3-4 actionable improvement steps specific to the "${roleName}" role`;

  try {
    const message = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const choice = message?.choices?.[0];
    const messageContent = choice?.message?.content;

    let responseText = messageContent;
    if (Array.isArray(responseText)) {
      responseText = responseText
        .map((part) => typeof part === 'string' ? part : (part?.text || ''))
        .join(' ');
    }

    if (typeof responseText !== 'string') {
      throw new Error('No JSON found in response');
    }

    const trimmedText = responseText.trim();
    let result;

    try {
      result = JSON.parse(trimmedText);
    } catch (error) {
      const jsonMatch = trimmedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    }

    // Validate result structure
    if (!result.skillsFound || !Array.isArray(result.skillsFound)) {
      result.skillsFound = [];
    }
    if (!result.missingSkills || !Array.isArray(result.missingSkills)) {
      result.missingSkills = [];
    }
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      result.score = 0;
    }
    if (!result.feedback || typeof result.feedback !== 'string') {
      result.feedback = 'Unable to generate feedback';
    }
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      result.suggestions = [];
    }

    return result;
  } catch (error) {
    throw new Error('Failed to analyze resume: ' + error.message);
  }
};

module.exports = { analyzeResumeWithAI };
