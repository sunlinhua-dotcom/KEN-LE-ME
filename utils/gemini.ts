import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const BASE_URL = process.env.EXPO_PUBLIC_GEMINI_BASE_URL || "https://api.apiyi.com/v1";
// 模型可由环境变量覆盖,改模型无需改代码/重新构建
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-3.5-flash";

export interface WineItem {
    name: string;
    menuPrice: number | null;
    onlinePrice: number | null;
    ratio: number | null;
    diff: number | null; // Added diff for price difference
    characteristics: string;
    rating: number;
    /** 针对这一款的毒舌一句(≤20 字,中文,犀利) */
    roast?: string;
    /** 这一款的知识介绍(产区 / 品种 / 为何出名,≤45 字,中文) */
    knowledge?: string;
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

export async function analyzeWineList(imageUris: string[]): Promise<AnalysisResult> {

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
        console.log(`✂️ Processing ${imageUris.length} images...`);

        // Process ALL images in parallel
        const base64Promises = imageUris.map(async (uri) => {
            // Compress and Resize locally
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );

            if (manipResult.base64) return manipResult.base64;

            // Fallback for web/others if base64 missing
            console.warn("⚠️ Manipulator didn't return base64, reading from file...");
            if (Platform.OS === 'web') {
                const response = await fetch(manipResult.uri);
                const blob = await response.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        if (typeof reader.result === 'string') resolve(reader.result.split(',')[1]);
                        else reject(new Error("Failed to convert image"));
                    };
                    reader.readAsDataURL(blob);
                });
            } else {
                return await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
            }
        });

        const base64List = await Promise.all(base64Promises);

        if (base64List.some(b => !b)) throw new Error("Failed to process one or more images");

        const PROMPT = `
      You are a Master Sommelier and Wine Market Auditor for China.
      Analyze these images (Wine List Pages or Multiple Bottles).

      **Tasks:**
      1. **DETECT TYPE & MERGE:**
         - These images belong to ONE session (e.g. page 1, page 2 of a menu OR multiple bottles on a table).
         - Treat them as a SINGLE combined input.
         - If ANY image contains a list of prices, treat the whole set as "menu".
         - If ALL images are just bottles with no text list, treat as "single" (collection of bottles).
      
      2. **CRITICAL FOR MENUS ("menu"):** 
         - Extract items from ALL images.
         - **Deduplicate** if the same item appears in overlapping photos.
         - **EVERY SINGLE ITEM** with a price must be extracted.
         - **DO NOT ignore text-only items.**
         - Determine the final list of unique wine/beverage items.

      3. **CRITICAL FOR BOTTLES ("single"):**
         - Identify ALL unique bottles across all photos.
         - **menuPrice MUST BE NULL.**
         - Estimate the online retail price for each.
      
      4. **GENERAL ANALYSIS:**
         - Estimate China online retail price (JD/Taobao).
         - Provide tasting notes/characteristics (in Chinese).
         - Provide a 1-10 rating.
         - Generate a witty, short, savage/funny summary in Chinese.
         - For EACH item, also write a "roast": a single savage/funny one-liner
           in Chinese, MAX 20 characters, sharp and specific to THAT item
           (mock the pricing if overpriced, praise if good value). No emoji inside roast.
         - For EACH item, also write "knowledge": a useful intro in Chinese (MAX 45
           characters) — origin region / grape or category / why it's notable / a
           drinking tip. Educational and specific, not generic. No emoji inside.

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
            "rating": number,
            "roast": "中文毒舌一句,≤20字",
            "knowledge": "中文知识介绍,≤45字"
          }
        ]
      }
    `;

        console.log("🚀 Sending to AI (Yinli/OpenAI Proxy)...");

        // Prepare content array with text prompt + all images
        const contentMessage = [
            { type: "text", text: PROMPT },
            ...base64List.map(b64 => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${b64}` }
            }))
        ];

        if (API_KEY.startsWith('sk-')) {
            const TARGET_MODEL = MODEL;
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
                            content: contentMessage
                        }
                    ],
                    max_tokens: 8192
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
                    const aggressiveSafe = jsonString.replace(/[\r\n\t]+/g, " ");
                    result = JSON.parse(aggressiveSafe);
                } catch (e) {
                    console.error("☠️ JSON Parse Fatal:", e);
                    console.log("Bad JSON String:", jsonString);
                    throw new Error("无法解析 AI 返回的数据，请重试。");
                }
            }

            return processItems(result);

        } else {
            // Fallback for native Google keys —— 动态 import,避免 SDK 进首屏主包
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: MODEL });

            // Construct parts for Google SDK
            const parts = [
                PROMPT,
                ...base64List.map(b64 => ({ inlineData: { data: b64, mimeType: "image/jpeg" } }))
            ];

            const resultResponse = await model.generateContent(parts);

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
