FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including serve globally)
RUN npm install
RUN npm install -g serve

# Copy project files
COPY . .

# Build the web app
RUN npm run build

# Expose port 8080 (Zeabur default)
EXPOSE 8080

# Serve the 'dist' folder on port 8080
CMD ["serve", "dist", "-s", "-l", "8080"]
