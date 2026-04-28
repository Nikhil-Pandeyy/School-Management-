import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is not defined in the environment.");
    }
    aiClient = new GoogleGenAI({ apiKey: key || '' });
  }
  return aiClient;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const getAIAssistantResponse = async (
  prompt: string,
  history: ChatMessage[] = [],
  context: string = ""
) => {
  try {
    const ai = getAiClient();
    const systemInstruction = `You are Nexus AI Assistant, an elite virtual intelligence integrated into the EduCloud school management platform. 
    Your goal is to assist users (students, teachers, and school administrators) with navigating the platform, analyzing academic performance, summarizing attendance, and providing administrative support.
    
    Current User Context: ${context}
    
    Capabilities:
    - Explain features like Student Directory, Attendance Tracking, Results, and Permissions.
    - Provide insights into school metrics if data is provided.
    - Assist in drafting emails or school notifications.
    - Act as a pedagogical assistant for teachers.
    
    Tone: Professional, highly efficient, intelligent, and supportive. Use Markdown for structured responses.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
      },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
    });

    return response.text || "No response content";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later.";
  }
};
