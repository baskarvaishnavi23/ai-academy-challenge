export type ReflectionMode = 'reflection' | 'summary' | 'brainstorm' | 'action_plan';

export interface ReflectionTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  mode?: ReflectionMode;
  timestamp: number;
  modelUsed?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  snippet: string;
  createdAt: number;
  updatedAt: number;
  sentiment?: string;
  tags: string[];
  isStarred?: boolean;
  turns: ReflectionTurn[];
  summary?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
