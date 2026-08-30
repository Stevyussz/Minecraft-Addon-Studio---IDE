import type { ChatCompletionRequest, ChatMessage, AppSettings } from '../../shared/types'

export interface ChatStreamOptions {
  onData: (chunk: string) => void
  onComplete: () => void
  onError: (error: Error) => void
  signal?: AbortSignal
}

/**
 * OpenAI-compatible client abstraction.
 * Built to support local 9Router configurations or remote endpoints.
 * Implements streaming via native Node fetch.
 */
export class OpenAIClient {
  private baseUrl: string
  private apiKey: string
  private defaultModel: string

  constructor(settings: AppSettings['ai']) {
    // Default to a 9Router standard endpoint if empty, but prefer user settings
    this.baseUrl = settings.baseUrl || 'http://localhost:20128/v1'
    this.apiKey = settings.apiKey || ''
    this.defaultModel = settings.defaultModel || 'auto'
  }

  /**
   * Streams a chat completion back to the provided callbacks.
   */
  async streamChat(request: ChatCompletionRequest, options: ChatStreamOptions): Promise<void> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`

    const payload = {
      model: request.model || this.defaultModel,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      // ReadableStream iteration
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        // Process SSE lines
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              options.onData(content)
            }
          } catch (e) {
            console.warn('[OpenAIClient] Failed to parse stream chunk:', data, e)
          }
        }
      }

      options.onComplete()

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Safe to ignore or explicitly signal cancellation
        options.onComplete()
      } else {
        options.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
}
