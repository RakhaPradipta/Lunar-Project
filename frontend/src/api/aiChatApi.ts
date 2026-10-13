/** Klien API untuk WisataBot — asisten AI seputar desa wisata platform ini. */

import { API_URL } from './config';
import { isDemoMode, demoDelay } from './demoMode';
import { demoAiReply } from './demoData';

const BASE = API_URL;

export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  reply: string;
  mode: 'llm' | 'fallback';
}

export interface AiStatus {
  mode: 'llm' | 'fallback';
  botName: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 429) {
    throw new Error('Terlalu banyak pertanyaan. Tunggu sebentar ya 😊');
  }
  if (!res.ok) {
    throw new Error('WisataBot sedang istirahat, coba lagi nanti.');
  }
  return (await res.json()) as T;
}

export const aiChatApi = {
  async ask(message: string, history: AiChatTurn[]): Promise<AiChatResponse> {
    if (isDemoMode()) {
      await demoDelay(600);
      return { reply: demoAiReply(message), mode: 'fallback' };
    }
    const res = await fetch(`${BASE}/api/AiChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    return handle<AiChatResponse>(res);
  },

  async status(): Promise<AiStatus> {
    if (isDemoMode()) {
      return { mode: 'fallback', botName: 'WisataBot (Demo)' };
    }
    const res = await fetch(`${BASE}/api/AiChat/status`);
    return handle<AiStatus>(res);
  },
};
