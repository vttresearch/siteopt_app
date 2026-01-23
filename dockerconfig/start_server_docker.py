import os
import signal
import sys
import time

from spine_engine.server.engine_server import EngineServer, ServerSecurityModel


def main(argv):
    if len(argv) != 2 and len(argv) != 4:
        print(
            f"Spine Engine Server\n\nUsage:\n  python {argv[0]} <port>\n"
            f"or\n  python {argv[0]} <port> stonehouse <path_to_security_folder>\n"
            f"to enable security."
        )
        return 2

    port = int(argv[1])
    security_model = ServerSecurityModel.NONE
    security_path = ""

    if len(argv) == 4:
        # argv[2] expected to be "stonehouse"
        security_model = ServerSecurityModel.STONEHOUSE
        security_path = argv[3]

    server = EngineServer("tcp", port, security_model, security_path)

    stopping = False

    def _stop(*_args):
        nonlocal stopping
        stopping = True

    # Handle Docker stop (SIGTERM) and Ctrl+C
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    print(f"Spine Engine Server listening on port {port} (pid={os.getpid()})")
    try:
        while not stopping:
            time.sleep(0.5)
    finally:
        try:
            server.close()
        except Exception as e:
            print(f"Error closing server: {type(e).__name__}: {e}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
