import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const BASE_URL = process.env.EXPO_PUBLIC_GEMINI_BASE_URL || "https://api.openai.com/v1";

export interface WineItem {
    name: string;
    menuPrice: number | null;
    onlinePrice: number | null;
    ratio: number | null;
    characteristics: string;
    rating: number;
}

export interface AnalysisResult {
    type: 'menu' | 'single';
    summary: string;
    items: WineItem[];
}

const MOCK_DATA: AnalysisResult = {
    type: 'menu',
    summary: "⚠️ 分析服务暂时不可用 (Mock Data)。请检查 API Key 设置。",
    items: [
        { name: "示例 - 奔富 407", menuPrice: 1280, onlinePrice: 600, ratio: 2.1, characteristics: "澳洲名庄，商务宴请硬通货", rating: 8.5 },
    ]
};

export async function analyzeWineList(imageUri: string): Promise<AnalysisResult> {
    if (!API_KEY) {
        console.error("❌ No API Key found.");
        return { ...MOCK_DATA, summary: "未配置 API Key，请在 .env 中设置。" };
    }

    try {
        let base64 = "";

        // --- 1. Image Processing ---
        if (Platform.OS === 'web') {
            console.log("🌐 Processing image for Web...");
            const response = await fetch(imageUri);
            const blob = await response.blob();
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result.split(',')[1]);
                    } else {
                        reject(new Error("Failed to convert image to base64"));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } else {
            console.log("📱 Processing image for Native...");
            base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
        }

        if (!base64) throw new Error("Failed to process image data");

        const PROMPT = `
      You are a Master Sommelier and Wine Market Auditor for China.
      Analyze this image (Wine List or Single Bottle).

      **Tasks:**
      1. Identify if it is a "menu" (list of wines) or "single" (one bottle).
      2. Identify the wine name/vintage.
      3. For "menu": Identify menu price (look for numbers near the wine). Estimate China online retail price (JD/Taobao).
      4. For "single": Estimate China online retail price.
      5. Provide tasting notes/characteristics (in Chinese).
      6. Provide a 1-10 rating (quality/reputation).
      7. Generate a witty, short, savage/funny summary in Chinese about the value.

      **Return JSON ONLY:**
      {
        "type": "menu" | "single",
        "summary": "Chinese summary string",
        "items": [
          {
            "name": "Wine Name",
            "menuPrice": number | null, 
            "onlinePrice": number | null, 
            "ratio": number | null, 
            "characteristics": "Chinese description",
            "rating": number 
          }
        ]
      }
    `;

        console.log("🚀 Sending to AI (Yinli/OpenAI Proxy)...");

        if (API_KEY.startsWith('sk-')) {
            // Use the newly discovered model
            const TARGET_MODEL = "gemini-3-flash-preview";
            console.log(`🔗 Using Model: ${TARGET_MODEL}`);

            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: TARGET_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: PROMPT },
                                {
                                    type: "image_url",
                                    image_url: { url: `data:image/jpeg;base64,${base64}` }
                                }
                            ]
                        }
                    ],
                    max_tokens: 2000
                })
            });

            const json = await response.json();

            if (json.error) {
                console.error("❌ API Error:", json.error);
                throw new Error(json.error.message || JSON.stringify(json.error));
            }

            const content = json.choices?.[0]?.message?.content || "";
            const cleanText = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);

        } else {
            // Fallback for native Google keys, assuming they might not have access to 3.0-flash-preview yet
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const result = await model.generateContent([
                PROMPT,
                { inlineData: { data: base64, mimeType: "image/jpeg" } }
            ]);

            const response = await result.response;
            return JSON.parse(response.text().replace(/```json/g, '').replace(/```/g, '').trim());
        }

    } catch (error) {
        console.error("❌ Analysis Error:", error);
        return {
            ...MOCK_DATA,
            summary: `😓 出错了: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
