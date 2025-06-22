// frontend/api.js

// 在本地测试时，我们指向本地后端。部署后会再次修改这里。
const API_URL = 'https://doiornot.onrender.com/api/analyze';

export async function analyzeImage(imageDataUrl, aiType) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageDataUrl, aiType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("API 错误:", errorData);
            throw new Error(errorData.details || 'API 请求失败');
        }
        return response.json();
    } catch (error) {
        console.error("Fetch 错误:", error);
        throw error; // 将错误继续抛出，让 main.js 处理
    }
}