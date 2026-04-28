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

export async function getCampusGuideResponse(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  try {
    const ai = getAiClient();
    const systemInstruction = `You are Nexus, the AI Assistant for a modern School Management System called "EduCloud". 
    Your goal is to help students, teachers, and admins navigate the application and understand its features.
    
    Key Features of EduCloud:
    - Dashboard: Overview of school stats, attendance, and birthdays.
    - Chat: Real-time communication for classes, general announcements, and direct messages. Students can download academic records from Nexus!
    - Attendance: View and manage attendance records.
    - Results: Check academic performance and exam results.
    - Classes: Manage schedules and class lists.
    - School Profile: View school information and location.
    - Settings: Manage profile, security, and preferences. Students can upload profile pictures here.
    - Admission: Students can download their official admission letter from the dashboard.
    
    Style:
    - Technical yet accessible, highly organized, and supportive.
    - Use emojis to emphasize clarity (e.g., ⚡, 🔍, 📊, 🛡️).
    
    Always identify yourself as Nexus and focus on architectural clarity of the EduCloud platform.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini AI Client Error:", error);
    return `I'm sorry, I'm having trouble connecting to my brain right now. (${error.message}) 🤖`;
  }
}
