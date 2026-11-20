# Máy chủ chạy thử trên máy của bạn (chỉ dùng khi phát triển).
# Giống "python -m http.server" nhưng tắt bộ nhớ đệm, nên sửa file xong
# chỉ cần tải lại trang (F5) là thấy thay đổi.
#
# Cách chạy:  python serve.py        rồi mở  http://localhost:5500
import http.server
import socketserver
import os
import sys

PORT = int(os.environ.get("PORT", 5500))

# Cửa sổ dòng lệnh Windows đôi khi không in được chữ có dấu: chuyển sang UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",  # Windows đôi khi đoán sai kiểu file .js
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("", PORT), NoCacheHandler) as httpd:
        print(f"Đang chạy tại http://localhost:{PORT}  (bấm Ctrl + C để dừng)")
        httpd.serve_forever()
