import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Guarantee top-level JSON deserialization before route registration
app.use(express.json({ limit: '1mb' }));

// Lazy GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Fallback Model Ladder as specified by production directives
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface ContentPart {
  text: string;
}

interface MessageTurn {
  role: 'user' | 'model' | 'assistant';
  text: string;
}

// Resilient fallback generator utility
async function generateContentWithFallback(params: {
  contents: Array<{ role: string; parts: ContentPart[] }> | string;
  systemInstruction?: string;
  temperature?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getAIClient();
  let lastError: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const config: Record<string, unknown> = {};
      if (params.systemInstruction) {
        config.systemInstruction = params.systemInstruction;
      }
      if (typeof params.temperature === 'number') {
        config.temperature = params.temperature;
      }

      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const text = response.text || '';
      return { text, modelUsed: model };
    } catch (err: unknown) {
      lastError = err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini Fallback] Model ${model} encountered error:`, errorMessage);

      // Check if recoverable status or continue to next model in ladder
      const isRecoverable =
        errorMessage.includes('503') ||
        errorMessage.includes('429') ||
        errorMessage.includes('404') ||
        errorMessage.includes('500') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('NOT_FOUND');

      if (!isRecoverable && model === MODEL_FALLBACK_LADDER[MODEL_FALLBACK_LADDER.length - 1]) {
        break;
      }
    }
  }

  throw lastError || new Error('All models in fallback ladder failed.');
}

// Health Check API
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Reflection & Multi-turn Conversation Endpoint
app.post('/api/gemini/reflect', async (req: Request, res: Response) => {
  try {
    // Defensive payload ingestion with safe fallbacks
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const mode = typeof body.mode === 'string' ? body.mode : 'reflection';
    const history: MessageTurn[] = Array.isArray(body.history) ? body.history : [];

    if (!prompt) {
      res.status(400).json({ error: 'Prompt cannot be empty.' });
      return;
    }

    if (prompt.length > 10000) {
      res.status(400).json({ error: 'Prompt exceeds maximum character limit of 10,000.' });
      return;
    }

    // Prepare system instruction according to reflection mode
    let systemInstruction = `You are a thoughtful, empathetic, and intellectually curious AI journaling partner and reflection guide.
Your purpose is to help the user process their thoughts, discover clarity, uncover blind spots, and foster personal growth.
Always maintain a supportive, non-judgmental, insightful, and grounded tone.
Never invent personal memories for the user. Format responses with clean Markdown, thoughtful headers, and gentle open-ended questions when appropriate.`;

    if (mode === 'summary') {
      systemInstruction += `\nFOCUS MODE: Summary & Key Insights. Synthesize the user's thoughts into core themes, emotional undertones, and 3 key actionable takeaways.`;
    } else if (mode === 'brainstorm') {
      systemInstruction += `\nFOCUS MODE: Creative Brainstorming. Help the user brainstorm fresh perspectives, creative solutions, divergent possibilities, and experimental next steps.`;
    } else if (mode === 'action_plan') {
      systemInstruction += `\nFOCUS MODE: Actionable Next Steps. Break down what the user shared into clear, low-friction, realistic next actions they can take today or this week.`;
    } else {
      systemInstruction += `\nFOCUS MODE: Deep Reflection. Inquire gently about the user's emotional state, validate their experience, and ask 1-2 profound questions that invite deeper self-inquiry.`;
    }

    // Format conversation history for Gemini API
    const formattedContents: Array<{ role: string; parts: ContentPart[] }> = [];

    // Add previous turns if provided
    for (const turn of history) {
      if (!turn || typeof turn.text !== 'string' || !turn.text.trim()) continue;
      formattedContents.push({
        role: turn.role === 'user' ? 'user' : 'model',
        parts: [{ text: turn.text.trim() }],
      });
    }

    // Add current turn
    formattedContents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const result = await generateContentWithFallback({
      contents: formattedContents,
      systemInstruction,
      temperature: 0.7,
    });

    res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Error generating reflection:', err);
    res.status(500).json({
      error: 'Failed to generate reflection from Gemini.',
      details: message,
    });
  }
});

// Auto-Title & Quick Insight generation
app.post('/api/gemini/title', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!content) {
      res.status(400).json({ error: 'Content is required for title generation.' });
      return;
    }

    const snippet = content.slice(0, 1500);
    const systemInstruction = `You generate concise, poetic, or clear journal entry titles and brief mood tags.
Respond with JSON matching this exact structure:
{
  "title": "3 to 6 word title capturing the essence",
  "tags": ["1-word tag", "1-word tag"],
  "sentiment": "Calm" | "Inspired" | "Reflective" | "Challenged" | "Grateful" | "Seeking Clarity"
}`;

    const result = await generateContentWithFallback({
      contents: `Generate a title, 2 tags, and mood for this journal reflection excerpt:\n\n"${snippet}"`,
      systemInstruction,
      temperature: 0.3,
    });

    let parsed: Record<string, unknown> = {};
    try {
      const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        title: snippet.slice(0, 40) + '...',
        tags: ['Reflection'],
        sentiment: 'Reflective',
      };
    }

    res.json({
      success: true,
      title: parsed.title || 'Journal Reflection',
      tags: parsed.tags || ['Reflection'],
      sentiment: parsed.sentiment || 'Reflective',
      modelUsed: result.modelUsed,
    });
  } catch (err: unknown) {
    console.error('Error generating title:', err);
    res.status(500).json({
      error: 'Failed to generate title',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
