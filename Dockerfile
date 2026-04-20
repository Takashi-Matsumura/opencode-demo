FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# opencode CLI (SST official installer, installs to $HOME/.opencode/bin)
RUN curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path \
    && ln -s /root/.opencode/bin/opencode /usr/local/bin/opencode

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

EXPOSE 3000 4097

ENV HOME=/root
ENV PTY_CMD=/usr/local/bin/opencode
ENV SHELL=/bin/bash

CMD ["npm", "run", "dev:all"]
