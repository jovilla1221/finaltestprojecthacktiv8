#!/usr/bin/env python3
import http.server
import socketserver
import json
import urllib.request
import urllib.error
import os

PORT = 8088

# Read .env file from apps/api/.env if present
api_key = os.environ.get("AI_ROUTER_API_KEY", "")
env_path = os.path.join(os.path.dirname(__file__), "apps", "api", ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("AI_ROUTER_API_KEY="):
                api_key = line.split("=", 1)[1].strip('"\'')

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(__file__), "apps", "web"), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/v1/public-ai/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode("utf-8"))
                user_message = data.get("message", "")
            except Exception as e:
                user_message = ""

            # Call Google Gemini API securely using api_key from .env
            target_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"
            
            payload = {
                "systemInstruction": {
                    "parts": [{
                        "text": "Anda adalah Asisten AI cerdas untuk aplikasi kasir digital MrikiPOS. Berikan jawaban yang profesional, ramah, dan ringkas menggunakan Markdown. Saat ini, Anda memiliki akses ke data realtime MrikiPOS berikut (Gunakan data ini HANYA jika pengguna menanyakan omzet, laporan, transaksi, atau stok):\n\nDATA REALTIME HARI INI:\n- Total Omzet Hari Ini: Rp 3.450.000\n- Total Transaksi: 42 transaksi selesai\n- Produk Paling Laris: Kopi Susu Aren (15 item terjual)\n- Stok Menipis: Gula Pasir (sisa 2 kg), Susu UHT (sisa 3 liter)\n\nInstruksi Tambahan: Jika ditanya tentang penjualan atau omzet, buatkan tabel ringkasan atau bullet points yang rapi dan menarik."
                    }]
                },
                "contents": [{"parts": [{"text": user_message}]}]
            }

            req = urllib.request.Request(
                target_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            try:
                with urllib.request.urlopen(req) as response:
                    res_body = response.read().decode("utf-8")
                    gemini_res = json.loads(res_body)
                    reply_text = gemini_res["candidates"][0]["content"]["parts"][0]["text"]
                    
                    response_json = {
                        "success": True,
                        "data": {
                            "response": reply_text
                        }
                    }
                    self.wfile.write(json.dumps(response_json).encode("utf-8"))
            except urllib.error.HTTPError as err:
                err_text = err.read().decode("utf-8")
                response_json = {
                    "success": False,
                    "error": f"Gemini API Error: {err_text}"
                }
                self.wfile.write(json.dumps(response_json).encode("utf-8"))
            except Exception as e:
                response_json = {
                    "success": False,
                    "error": f"Backend Error: {str(e)}"
                }
                self.wfile.write(json.dumps(response_json).encode("utf-8"))
        else:
            self.send_error(404, "Not Found")

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        httpd.serve_forever()
