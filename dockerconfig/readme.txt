Instructions on how to make and run a container from the Dockerfile in this same folder.
The container contains the required Spine Tools for executing the SiteOpt Spine Toolbox project
in SiteOpt-web-interface.

BUILD CONTAINER IMAGE
docker build -t siteoptxspine:0.1 .

RUN IN INTERACTIVE FOREGROUND MODE AND PUBLISH PORTS
docker run -it -p 49152-49202:49152-49202 siteoptxspine:0.1

ACCESS CONTAINER (replace upbeat_swanson with the actual container name)
docker ps
docker exec –it upbeat_swanson /bin/bash

START SERVER MANUALLY
python start_server.py 49152
