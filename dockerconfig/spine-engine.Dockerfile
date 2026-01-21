FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Helsinki

# System deps
# System deps (incl. Qt/PySide6 runtime libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    curl \
    wget \
    ca-certificates \
    build-essential \
    git \
    tzdata \
    \
    # Python build deps (yours)
    libssl-dev \
    zlib1g-dev \
    libncurses-dev \
    libreadline-dev \
    libsqlite3-dev \
    libgdbm-dev \
    libdb5.3-dev \
    libbz2-dev \
    libexpat1-dev \
    liblzma-dev \
    tk-dev \
    libffi-dev \
    \
    # OpenGL / EGL
    libegl1 \
    libgl1 \
    libopengl0 \
    \
    # Qt base + IPC
    libglib2.0-0 \
    libdbus-1-3 \
    \
    # X11 / XCB basics
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxi6 \
    libsm6 \
    libice6 \
    libxcb1 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    \
    # Qt “xcb” platform plugin deps (common missing ones)
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    libxss1 \
    \
    # xcb util libs (often required by Qt)
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-randr0 \
    libxcb-render-util0 \
    libxcb-shape0 \
    libxcb-shm0 \
    libxcb-sync1 \
    libxcb-xfixes0 \
    libxcb-xinerama0 \
    \
    # Fonts / fontconfig (fixes libfontconfig.so.1 etc.)
    libfontconfig1 \
    libfreetype6 \
    fonts-dejavu-core \
    \
    # Audio (Qt sometimes expects these even headless)
    libasound2 \
    libpulse0 \
  && rm -rf /var/lib/apt/lists/*



RUN add-apt-repository ppa:deadsnakes/ppa -y && apt-get update \
  && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev libpython3.11-dev \
  && rm -rf /var/lib/apt/lists/*
RUN ln -sf /usr/bin/python3.11 /usr/bin/python
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

RUN wget -q https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-1.11.7-linux-x86_64.tar.gz \
    && tar -xzf julia-1.11.7-linux-x86_64.tar.gz \
    && mv julia-1.11.7 /opt/julia \
    && ln -sf /opt/julia/bin/julia /usr/bin/julia \
    && rm julia-1.11.7-linux-x86_64.tar.gz

WORKDIR /juliaEnv

COPY dockerconfig/Project.toml /juliaEnv/Project.toml

ENV PYTHON=/usr/bin/python
ENV JULIA_NUM_PRECOMPILE_TASKS=1
ENV JULIA_PKG_PRECOMPILE_AUTO=0


RUN julia -e 'ENV["PYTHON"]="/usr/bin/python"; import Pkg; Pkg.activate("."); \
    Pkg.add(url="https://github.com/spine-tools/SpineOpt.jl.git", rev="elexia"); \
    Pkg.add(url="https://github.com/spine-tools/SpinePeriods.jl.git", rev="clustering"); \
    Pkg.resolve(); Pkg.instantiate();'

WORKDIR /
RUN git clone --depth 1 https://github.com/spine-tools/Spine-Toolbox.git

WORKDIR /Spine-Toolbox/
RUN python -m pip install --no-cache-dir -r requirements.txt
RUN python -m pip install --no-cache-dir scikit-learn-extra
RUN python -m pip install --no-cache-dir "numpy<2" --upgrade

COPY dockerconfig/start_server_docker.py /srv/start_server.py

EXPOSE 50001
CMD ["python", "-u", "/srv/start_server.py", "50001"]
