/** A text turn kept in the per-socket conversation history. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
