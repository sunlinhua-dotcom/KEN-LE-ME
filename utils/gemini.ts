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
    diff: number | null; // Added diff for price difference
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
        { name: "示例 - 奔富 407", menuPrice: 1280, onlinePrice: 600, ratio: 2.1, diff: 680, characteristics: "澳洲名庄，商务宴请硬通货", rating: 8.5 },
    ]
};

export async function analyzeWineList(imageUri: string): Promise<AnalysisResult> {

    // Helper to process and sort items
    const processItems = (result: AnalysisResult): AnalysisResult => {
        if (!result.items) return result;

        // Calculate diff for each item if not present
        const processedItems = result.items.map(item => {
            const menuPrice = item.menuPrice || 0;
            const onlinePrice = item.onlinePrice || 0;
            // Calculate diff if both prices exist
            const diff = (menuPrice > 0 && onlinePrice > 0) ? (menuPrice - onlinePrice) : null;

            return {
                ...item,
                diff: item.diff ?? diff
            };
        });

        // Sort by diff in descending order (highest profit margin first)
        processedItems.sort((a, b) => (b.diff || 0) - (a.diff || 0));

        return {
            ...result,
            items: processedItems
        };
    };

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
      2. **CRITICAL FOR MENUS:** You MUST extract AND analyze MULTIPLE wines if visible. Do not just pick one. Create a separate item for EVERY distinct wine found.
      3. For "menu": Identify menu price (look for numbers near the wine). Estimate China online retail price (JD/Taobao).
      4. For "single": Estimate China online retail price.
      5. Provide tasting notes/characteristics (in Chinese) for EACH item.
      6. Provide a 1-10 rating (quality/reputation).
      7. Generate a witty, short, savage/funny summary in Chinese about the overall selection.
      
      **Summary Guidelines (CRITICAL):**
      - Structure the summary to first highlight "💰Best Value" (最值), then "💸Most Expensive" (最贵), and finally "😈Savage Review" (毒舌点评).
      - Do NOT use actual newlines in the summary text. Use spaces.

      **Return JSON ONLY:**
      {
        "type": "menu" | "single",
        "summary": "💰最值: ... 💸最贵: ... 😈点评: ...",
        "items": [
          {
            "name": "Wine Name",
            "menuPrice": number | null, 
            "onlinePrice": number | null, 
            "ratio": number | null, 
            "characteristics": "Chinese description (Taste, Grape, Region)",
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
                    max_tokens: 4096
                })
            });

            const json = await response.json();

            if (json.error) {
                console.error("❌ API Error:", json.error);
                throw new Error(json.error.message || JSON.stringify(json.error));
            }

            // Robust JSON extraction
            const cleanText = (json.choices?.[0]?.message?.content || "")
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const firstOpen = cleanText.indexOf('{');
            const lastClose = cleanText.lastIndexOf('}');

            let jsonString = cleanText;
            if (firstOpen !== -1 && lastClose !== -1) {
                jsonString = cleanText.substring(firstOpen, lastClose + 1);
            }

            // Attempt parsing
            let result: AnalysisResult;
            try {
                result = JSON.parse(jsonString);
            } catch (parseError) {
                console.warn("JSON Parse Failed, attempting cleanup:", parseError);

                try {
                    // NUCLEAR OPTION: Replace ALL structural newlines/tabs with spaces.
                    // This creates a single-line JSON string which is safe from "newline in string" errors.
                    const aggressiveSafe = jsonString.replace(/[\r\n\t]+/g, " ");
                    result = JSON.parse(aggressiveSafe);
                } catch (e) {
                    throw new Error(`JSON Parsing Failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. Try again.`);
                }
            }

            return processItems(result);

        } else {
            // Fallback for native Google keys
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const resultResponse = await model.generateContent([
                PROMPT,
                { inlineData: { data: base64, mimeType: "image/jpeg" } }
            ]);

            const response = await resultResponse.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(text);
            return processItems(result);
        }

    } catch (error) {
        console.error("❌ Analysis Error:", error);
        return {
            ...MOCK_DATA,
            summary: `😓 出错了 (解析失败): 请重试。\n错误细节: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
