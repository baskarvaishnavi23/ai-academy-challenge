import { ReflectionMode, ReflectionTurn } from '../types';

export interface GenerateReflectionParams {
  prompt: string;
  mode: ReflectionMode;
  history: Array<{ role: 'user' | 'model'; text: string }>;
}

export interface ReflectionResponse {
  success: boolean;
  text: string;
  modelUsed: string;
}

export interface TitleResponse {
  success: boolean;
  title: string;
  tags: string[];
  sentiment: string;
  modelUsed?: string;
}

/**
 * Generate Gemini reflection via server-side proxy
 */
export async function requestGeminiReflection(
  params: GenerateReflectionParams
): Promise<ReflectionResponse> {
  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate reflection from Gemini';
    try {
      const errData = await response.json();
      if (errData.details) errorMsg = `${errorMsg}: ${errData.details}`;
      else if (errData.error) errorMsg = `${errorMsg}: ${errData.error}`;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Auto-generate title and tags for journal entry
 */
export async function requestEntryTitle(content: string): Promise<TitleResponse> {
  const response = await fetch('/api/gemini/title', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    return {
      success: false,
      title: content.slice(0, 30) + '...',
      tags: ['Journal'],
      sentiment: 'Reflective',
    };
  }

  return response.json();
}
