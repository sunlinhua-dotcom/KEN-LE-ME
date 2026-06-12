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

# Build the web app
RUN npx expo export -p web

# Expose port 8080 (Zeabur default)
EXPOSE 8080

# Serve the 'dist' folder on port 8080
CMD ["serve", "dist", "-s", "-l", "8080"]
