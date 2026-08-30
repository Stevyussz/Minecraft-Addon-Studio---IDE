import { create } from 'zustand'
import type { ChatMessage } from '../../shared/types'

interface AiStore {
  messages: ChatMessage[]
  isGenerating: boolean
  error: string | null

  // Actions
  addMessage: (msg: ChatMessage) => void
  updateLastMessage: (chunk: string) => void
  setGenerating: (val: boolean) => void
  setError: (err: string | null) => void
  clearChat: () => void
  
  // High-level operations
  sendMessage: (content: string) => Promise<void>
  cancelGeneration: () => Promise<void>
}

export const useAiStore = create<AiStore>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am Antigravity. How can I help you with your Minecraft Bedrock Add-on today?',
      timestamp: Date.now(),
    }
  ],
  isGenerating: false,
  error: null,

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg], error: null })),
  
  updateLastMessage: (chunk) => set((state) => {
    if (state.messages.length === 0) return state
    
    const newMessages = [...state.messages]
    const lastIdx = newMessages.length - 1
    const lastMsg = newMessages[lastIdx]
    
    // Only append to an assistant message
    if (lastMsg.role === 'assistant') {
      newMessages[lastIdx] = { ...lastMsg, content: lastMsg.content + chunk }
    }
    
    return { messages: newMessages }
  }),

  setGenerating: (val) => set({ isGenerating: val }),
  setError: (err) => set({ error: err, isGenerating: false }),
  
  clearChat: () => set({ 
    messages: [{
      id: 'welcome',
      role: 'assistant',
      content: 'Chat cleared. How can I help?',
      timestamp: Date.now(),
    }], 
    error: null, 
    isGenerating: false 
  }),

  sendMessage: async (content: string) => {
    const { messages, addMessage, setGenerating, setError } = get()
    
    // Create user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    
    // Add user message to UI immediately
    addMessage(userMsg)
    
    // Create placeholder for assistant response
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }
    addMessage(assistantMsg)
    
    setGenerating(true)
    setError(null)
    
    try {
      // Send the request including the new user message
      const history = [...messages, userMsg]
      const result = await window.mas.aiChatRequest(history)
      
      if (!result.success) {
        setError(result.error ?? 'Failed to send message')
      }
    } catch (err) {
      setError(String(err))
    }
  },

  cancelGeneration: async () => {
    try {
      await window.mas.aiChatCancel()
    } finally {
      set({ isGenerating: false })
    }
  }
}))
