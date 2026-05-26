import threading

import webview

from app import app


def run_flask():
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    t = threading.Thread(target=run_flask)
    t.daemon = True
    t.start()

    webview.create_window(
        "My Flask App", "http://127.0.0.1:5000", width=1200, height=800
    )

    webview.start()
