const fetch = require('node-fetch');

const API_KEY = "sk-Yijg6QsrHpx4UTCQE6HqTRXJQ2Giqo9XvOvCoU5ZCAHFwuUA";
const BASE_URL = "https://yinli.one/v1";

async function testModels() {
    try {
        console.log(`Testing API Key against ${BASE_URL}/models...`);
        const response = await fetch(`${BASE_URL}/models`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Response body:", text);
            return;
        }

        const data = await response.json();
        console.log("Success! Available Models:");
        if (Array.isArray(data.data)) {
            data.data.forEach(model => {
                console.log(`- ${model.id}`);
            });
        } else {
            console.log("Raw Response:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Network or execution error:", error);
    }
}

testModels();
