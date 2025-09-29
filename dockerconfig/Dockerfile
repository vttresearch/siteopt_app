# Use the official Ubuntu base image
FROM ubuntu:24.04
# Set noninteractive mode for apt
ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
RUN apt-get update && apt-get install -y \
    software-properties-common \
    curl \
    wget \
    build-essential \
    libssl-dev \
    zlib1g-dev \
    libncurses5-dev \
    libncursesw5-dev \
    libreadline-dev \
    libsqlite3-dev \
    libgdbm-dev \
    libdb5.3-dev \
    libbz2-dev \
    libexpat1-dev \
    liblzma-dev \
    tk-dev \
    libffi-dev \
    git \
	tzdata \
	nano \
    && rm -rf /var/lib/apt/lists/*

# Set Timezone
ENV TZ=Europe/Helsinki

# Install Python 3.10
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get install -y python3.10 python3.10-venv python3.10-dev libpython3.10-dev
RUN ln -s /usr/bin/python3.10 /usr/bin/python
# RUN ln -s /usr/bin/python3.10 /usr/bin/python3
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.10

# Install Julia 1.11.5
RUN wget https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-1.11.5-linux-x86_64.tar.gz
RUN tar zxvf julia-1.11.5-linux-x86_64.tar.gz
RUN ln -s /julia-1.11.5/bin/julia /usr/bin/julia

# Set PYTHON env variable to point to Python 3.10 for PyCall and install SpineOpt
RUN julia -e 'ENV["PYTHON"]="usr/bin/python";import Pkg; Pkg.add("SpineOpt");'

# Install packages required by Spine Toolbox
RUN apt-get install -y libegl1 libgl1 libxkbcommon-x11-0

# Clone Spine Toolbox from Git and install
RUN git clone https://github.com/spine-tools/Spine-Toolbox.git
# Use WORKDIR instead of 'RUN cd ./path', which does not work for some reason
WORKDIR "/Spine-Toolbox/"
RUN python -m pip install -r requirements.txt

# Make 'python3' jupyter kernel
RUN python -m pip install ipykernel

# Make 'julia-1.11 jupyter kernel
RUN julia -e 'import Pkg; Pkg.add("IJulia");'
RUN julia -e 'import IJulia; IJulia.installkernel("julia");'

WORKDIR "/Spine-Toolbox/src/spine-engine/spine_engine/server/"
ENTRYPOINT ["python", "start_server.py", "49152"]
