FROM node:25.6.0-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
      git-core \
      ca-certificates && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Set working directory
WORKDIR /opt/semantic-release

# Copy package files
COPY package*.json ./

# Install dependencies locally
RUN npm ci && \
    npm cache clean --force

# Add node_modules/.bin to PATH
ENV PATH="/opt/semantic-release/node_modules/.bin:${PATH}"

# Add default semantic-release config and entrypoint wrapper
COPY default.releaserc.cjs semantic-release.sh ./
RUN chmod +x ./semantic-release.sh

ENTRYPOINT ["/opt/semantic-release/semantic-release.sh"]
