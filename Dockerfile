FROM node:20-alpine

WORKDIR /app

# 先装依赖(利用缓存)
COPY package.json ./
RUN npm install --legacy-peer-deps
RUN npm install react-native-svg

# 复制项目
COPY . .

# 构建静态站(前端已不含任何 key,无需构建期注入密钥)
RUN npx expo export -p web

EXPOSE 8080

# server.mjs:托管 dist 静态站 + 处理 /api/analyze 转发。
# 运行时从环境变量读 GEMINI_API_KEY(在 Zeabur 面板设置,不带 EXPO_PUBLIC_ 前缀)。
CMD ["node", "server.mjs"]
