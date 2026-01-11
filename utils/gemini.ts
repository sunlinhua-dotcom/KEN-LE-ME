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
      1. **DETECT TYPE:**
         - If the image contains a list of items with prices (text), treat as "menu".
         - If the image contains ONLY bottles (e.g. on a table, in hand) and NO price list, treat as "single".
      
      2. **CRITICAL FOR MENUS ("menu"):** 
         - You MUST extract AND analyze **EVERY SINGLE ITEM** with a visible price.
         - **DO NOT ignore text-only items.** Scan the **ENTIRE** image (Cocktails, Beers, Soft Drinks, Wines).
         - If a wine has MULTIPLE volumes (e.g. Glass/Bottle, 300ml/720ml), create a SEPARATE item for EACH pair.
           - Name format: "Name (Volume)" e.g. "Dassai 45 (300ml)".

      3. **CRITICAL FOR BOTTLES ("single"):**
         - **menuPrice MUST BE NULL.** Do not invent a menu price.
         - Estimate the online retail price (JD/Taobao).
      
      4. **GENERAL ANALYSIS:**
         - Estimate China online retail price (JD/Taobao).
         - Provide tasting notes/characteristics (in Chinese).
         - Provide a 1-10 rating.
         - Generate a witty, short, savage/funny summary in Chinese.
      
      **Summary Guidelines:**
      - Structure: 💰Best Value -> 💸Most Expensive -> 😈Savage Review.
      - **NO NEWLINES** in the summary string. Use spaces.

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
            "characteristics": "Chinese description",
            "rating": number 
          }
        ]
      }
    `;

        console.log("🚀 Sending to AI (Yinli/OpenAI Proxy)...");

        if (API_KEY.startsWith('sk-')) {
            const TARGET_MODEL = "gemini-2.0-flash-exp"; // Try a more stable model if available, or stick to flash-preview
            console.log(`🔗 Using Model: ${TARGET_MODEL}`);

            const response = await fetch(`${BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: TARGET_MODEL, // Switch to 2.0 Flash Exp for better instruction following potentially
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
                    max_tokens: 8192 // Increase token limit
                })
            });

            const json = await response.json();

            if (json.error) {
                console.error("❌ API Error:", json.error);
                throw new Error(json.error.message || JSON.stringify(json.error));
            }

            // 1. Log the raw output for debugging
            const cleanText = (json.choices?.[0]?.message?.content || "").trim();
            console.log("📝 Raw AI Output (Head):", cleanText.substring(0, 100));

            // 2. Extract JSON block more aggressively
            // Look for the first { and the last }
            const firstOpen = cleanText.indexOf('{');
            const lastClose = cleanText.lastIndexOf('}');

            let jsonString = "";
            if (firstOpen !== -1 && lastClose !== -1) {
                jsonString = cleanText.substring(firstOpen, lastClose + 1);
            } else {
                throw new Error("No JSON object found in response");
            }

            // 3. Attempt Parsing with cleanup
            let result: AnalysisResult;
            try {
                // Remove Markdown code blocks if they persist inside the block
                jsonString = jsonString
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    // Fix common trailing comma errors: , } -> } and , ] -> ]
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');

                // Sanitization: Escape unescaped newlines in JSON strings? 
                // It's tricky without a parser. The "Aggressive Safe" method below is decent.

                result = JSON.parse(jsonString);
            } catch (parseError) {
                console.warn("⚠️ Initial Parse Failed. Attempting aggressive cleanup...");
                try {
                    // Replace control characters (newlines/tabs) that might break JSON
                    // But be careful not to break valid spaces.
                    // This regex removes newlines/tabs globally, turning it into a single line.
                    const aggressiveSafe = jsonString
                        .replace(/[\r\n\t]+/g, " ")
                        // Try to fix "Expected ']'" by checking if it ended prematurely
                        // (Hard to fix programmatically without complex logic)
                        ;

                    result = JSON.parse(aggressiveSafe);
                } catch (e) {
                    console.error("☠️ JSON Parse Fatal:", e);
                    console.log("Bad JSON String:", jsonString);
                    throw new Error("无法解析 AI 返回的数据，请重试。");
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
