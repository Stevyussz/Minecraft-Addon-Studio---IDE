/**
 * Lightweight token estimator heuristic.
 * 
 * To remain "GA BERAT" (lightweight) and avoid installing heavy WASM-based 
 * tokenizers like tiktoken in the main process during Phase 3, we use a 
 * fast heuristic.
 * 
 * Typically:
 * - 1 token ~= 4 chars in English
 * - 1 token ~= 0.75 words
 * 
 * This is rough but sufficient for filtering context within safe limits.
 */
export class TokenEstimator {
  /**
   * Estimates the number of tokens in a given string.
   */
  static estimate(text: string): number {
    if (!text) return 0
    // A simple heuristic: length divided by 4
    return Math.ceil(text.length / 4)
  }

  /**
   * Truncates a string to approximately a target number of tokens.
   */
  static truncate(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    if (text.length <= maxChars) return text
    
    // Truncate and append ellipsis
    return text.slice(0, maxChars) + '\n...[Truncated for context limit]'
  }
}
