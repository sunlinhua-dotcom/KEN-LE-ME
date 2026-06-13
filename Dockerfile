FROM node:20-alpine

WORKDIR /app

# Copy package files (ensure you don't copy the lockfile if it causes issues, or regenerate it)
COPY package.json ./

# Install dependencies (force legacy peer deps to avoid conflicts)
RUN npm install --legacy-peer-deps
# Explicitly ensure react-native-svg is installed for web build
RUN npm install react-native-svg
RUN npm install -g serve

# Copy project files
COPY . .

# ─────────────────────────────────────────────────────────────
# 构建期环境变量:EXPO_PUBLIC_* 会在 `expo export` 时被内联进 JS 包,
# 因此必须在 build 阶段(RUN expo export 之前)就存在。
# Zeabur 会把面板里设置的服务环境变量作为 --build-arg 传进来。
# ─────────────────────────────────────────────────────────────
ARG EXPO_PUBLIC_GEMINI_API_KEY
ARG EXPO_PUBLIC_GEMINI_BASE_URL=https://api.apiyi.com/v1
ARG EXPO_PUBLIC_GEMINI_MODEL=gemini-3.5-flash
ENV EXPO_PUBLIC_GEMINI_API_KEY=$EXPO_PUBLIC_GEMINI_API_KEY
ENV EXPO_PUBLIC_GEMINI_BASE_URL=$EXPO_PUBLIC_GEMINI_BASE_URL
ENV EXPO_PUBLIC_GEMINI_MODEL=$EXPO_PUBLIC_GEMINI_MODEL

# Build the web app
RUN npx expo export -p web

# Expose port 8080 (Zeabur default)
EXPOSE 8080

# Serve the 'dist' folder on port 8080
CMD ["serve", "dist", "-s", "-l", "8080"]
