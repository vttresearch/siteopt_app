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

# Install Python 3.11
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get install -y python3.11 python3.11-venv python3.11-dev libpython3.11-dev
RUN ln -s /usr/bin/python3.11 /usr/bin/python
# RUN ln -s /usr/bin/python3.11 /usr/bin/python3
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Install Julia 1.11.7
RUN wget https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-1.11.7-linux-x86_64.tar.gz \
    && tar -xvzf julia-1.11.7-linux-x86_64.tar.gz \
    && mv julia-1.11.7 /opt/julia \
    && ln -s /opt/julia/bin/julia /usr/bin/julia \
    && rm julia-1.11.7-linux-x86_64.tar.gz

# Make dir for SiteOpt project Julia environment and copy Project.toml there
RUN mkdir juliaEnv
COPY Project.toml /juliaEnv/Project.toml
WORKDIR "/juliaEnv"
# Set PYTHON env variable to point to Python 3.11 for PyCall and
# install SpineOpt, SpinePeriods and deps from Project.toml
RUN julia -e 'ENV["PYTHON"]="/usr/bin/python"; \
    import Pkg;  \
    Pkg.activate(".");  \
    Pkg.add(url="https://github.com/spine-tools/SpineOpt.jl.git", rev="elexia");  \
    Pkg.add(url="https://github.com/spine-tools/SpinePeriods.jl.git", rev="clustering"); \
    Pkg.resolve(); \
    Pkg.instantiate();'

# Make 'julia-1.11 jupyter kernel
RUN julia -e 'import Pkg;  \
    Pkg.activate(".");  \
    Pkg.add("IJulia");'
RUN julia -e 'import Pkg;  \
    Pkg.activate(".");  \
    import IJulia;  \
    IJulia.installkernel("julia");'

# Install packages required by Spine Toolbox
RUN apt-get install -y libegl1 libgl1 libxkbcommon-x11-0

# Clone Spine Toolbox from Git and install
WORKDIR "/"
RUN git clone https://github.com/spine-tools/Spine-Toolbox.git
# Use WORKDIR instead of 'RUN cd ./path', which does not work for some reason
WORKDIR "/Spine-Toolbox/"
RUN python -m pip install -r requirements.txt
RUN python -m pip install scikit-learn-extra
# scikit-learn-extra is not compatible with numpy 2.0+
RUN python -m pip install "numpy<2" --upgrade

# Make 'python3' jupyter kernel
RUN python -m pip install ipykernel

WORKDIR "/Spine-Toolbox/src/spine-engine/spine_engine/server/"
ENTRYPOINT ["python", "start_server.py", "49152"]
