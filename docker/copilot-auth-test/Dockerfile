FROM python:3.11-slim

ARG COPILOT_CLI_VERSION=1.0.14
ARG COPILOT_SDK_VERSION=0.2.1

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /opt/copilot-auth-test

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dbus \
    dbus-user-session \
    git \
    gnome-keyring \
    libdbus-1-3 \
    libsecret-1-0 \
    libsecret-tools \
    nodejs \
    npm \
    procps \
    seahorse \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --upgrade pip && \
    python -m pip install github-copilot-sdk==${COPILOT_SDK_VERSION}

RUN npm install -g @github/copilot@${COPILOT_CLI_VERSION}

COPY sdk_auth_probe.py /opt/copilot-auth-test/sdk_auth_probe.py
COPY entrypoint.sh /opt/copilot-auth-test/entrypoint.sh
COPY keyring-session.sh /opt/copilot-auth-test/keyring-session.sh

RUN chmod +x /opt/copilot-auth-test/entrypoint.sh /opt/copilot-auth-test/keyring-session.sh

ENTRYPOINT ["/opt/copilot-auth-test/entrypoint.sh"]
CMD ["sleep", "infinity"]