# Dockerfile
FROM node:18

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy your source code
COPY . .

# Expose the port your app runs on
EXPOSE 4000

# Start the service
CMD ["node", "server.js"]
