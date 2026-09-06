# ==============================================================================
# YouTube Linux Audio Player - Production Dockerfile
# Supports running headless or with hardware ALSA / PulseAudio soundcard passthrough
# ==============================================================================

FROM node:20-bookworm-slim

# Set working directory & production environment
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    MPV_AO=alsa,pulse,null

# Install system dependencies: mpv, ffmpeg, python3, alsa-utils, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    mpv \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

# Install the latest official yt-dlp binary to ensure YouTube algorithm compatibility
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set up fallback ALSA config for headless container environments (null sink)
RUN echo 'pcm.!default {\n    type null\n}\nctl.!default {\n    type null\n}\n' > /etc/asound.conf

# Copy package manifests and install all dependencies (including devDependencies for build)
# Use npm ci if package-lock.json exists, with safe fallback to npm install
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
        npm ci --include=dev || npm install --include=dev; \
    else \
        npm install --include=dev; \
    fi

# Copy project source files
COPY . .

# Build Vite frontend and bundled Node server
RUN npm run build

# Remove devDependencies to keep image lean
RUN npm prune --omit=dev

# Add node user to audio group so it can access /dev/snd when mounted
RUN usermod -a -G audio node 2>/dev/null || true

# Expose web service port
EXPOSE 3000

# Start server using the compiled standalone bundle
CMD ["npm", "start"]
