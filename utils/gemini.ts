import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
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

        console.log("✂️ Compressing/Resizing Image...");
        // Compress and Resize locally to speed up upload & processing
        const manipResult = await ImageManipulator.manipulateAsync(
            imageUri,
            [{ resize: { width: 1024 } }], // Resize width to 1024px
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true } // Compress to 60% quality
        );

        if (manipResult.base64) {
            base64 = manipResult.base64;
            console.log("✅ Image compressed successfully.");
        } else {
            // Fallback
            console.warn("⚠️ Manipulator didn't return base64, reading from file...");
            if (Platform.OS === 'web') {
                const response = await fetch(manipResult.uri);
                const blob = await response.blob();
                base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
                        else reject(new Error("Failed to convert image"));
                    };
                    reader.readAsDataURL(blob);
                });
            } else {
                base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
            }
        }

        if (!base64) throw new Error("Failed to process image data");

        const PROMPT = `
      You are a Master Sommelier and Wine Market Auditor for China.
      Analyze this image (Wine List or Single Bottle).

      **Tasks:**
      1. Identify if it is a "menu" (list of wines) or "single" (one bottle).
      2. **CRITICAL FOR MENUS:** You MUST extract AND analyze **EVERY SINGLE ITEM** with a price.
         - **DO NOT ignore text-only items.**
         - scan the **ENTIRE** image for Cocktails, Beers, Soft Drinks, or Wines listed as text.
      3. **CRITICAL FOR MULTI-VOLUME ITEMS:** If a single wine has MULTIPLE prices for different volumes (e.g., "Glass/杯", "Bottle/瓶", "300ml", "720ml", "1800ml"):
         - You MUST create a **SEPARATE** JSON item for **EACH** volume/price pair.
         - Append the volume to the name (e.g., "Dassai 45 (300ml)", "Dassai 45 (720ml)").
         - DO NOT combine them into one item.
      4. For "menu": Identify menu price. Estimate China online retail price (JD/Taobao) *for that specific volume*.
      5. For "single": Estimate China online retail price.
      6. Provide tasting notes/characteristics (in Chinese).
      7. Provide a 1-10 rating.
      8. Generate a witty, short, savage/funny summary in Chinese.
      
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
