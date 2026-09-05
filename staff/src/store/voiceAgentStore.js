import { create } from 'zustand';

export const useVoiceAgentStore = create((set, get) => ({
  enabled: true,
  open: false,
  status: 'off',
  muted: false,
  error: '',
  messages: [],
  tools: [],
  setEnabled: (enabled) => set({ enabled }),
  setOpen: (open) => set({ open }),
  setStatus: (status) => set({ status }),
  setMuted: (muted) => set({ muted }),
  setError: (error) => set({ error: error || '' }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { id: `${Date.now()}-${state.messages.length}`, ...message }],
    })),
  appendAssistantDelta: (delta) =>
    set((state) => {
      const messages = [...state.messages];
      const last = [...messages].reverse().find((row) => row.role === 'ai' && row.partial);
      if (last) {
        return {
          messages: messages.map((row) =>
            row.id === last.id ? { ...row, text: `${row.text || ''}${delta || ''}`, partial: true } : row
          ),
        };
      }
      return {
        messages: [...messages, { id: `${Date.now()}-ai`, role: 'ai', text: delta || '', partial: true }],
      };
    }),
  finalizeAssistant: (text) =>
    set((state) => {
      const messages = [...state.messages];
      const last = [...messages].reverse().find((row) => row.role === 'ai' && row.partial);
      if (!last) {
        return text
          ? { messages: [...messages, { id: `${Date.now()}-ai`, role: 'ai', text, partial: false }] }
          : state;
      }
      return {
        messages: messages.map((row) =>
          row.id === last.id ? { ...row, text: text || row.text, partial: false } : row
        ),
      };
    }),
  addTool: (tool) =>
    set((state) => {
      const row = { id: tool.id || `${Date.now()}-${state.tools.length}`, ...tool };
      return {
        tools: [...state.tools, row],
        messages: [...state.messages, { id: `tool-${row.id}`, role: 'tool', tool: row }],
      };
    }),
  updateTool: (id, patch) =>
    set((state) => ({
      tools: state.tools.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      messages: state.messages.map((row) =>
        row.role === 'tool' && row.tool?.id === id ? { ...row, tool: { ...row.tool, ...patch } } : row
      ),
    })),
  resetLog: () => set({ messages: [], tools: [], error: '' }),
  getState: () => get(),
}));
