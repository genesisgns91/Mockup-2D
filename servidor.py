#!/usr/bin/env python3
"""Uso local: python3 servidor.py  → abre http://localhost:8000 (o navegador bloqueia o motor de realismo em file://)."""
import http.server,socketserver,webbrowser,os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
with socketserver.TCPServer(('',8000),http.server.SimpleHTTPRequestHandler) as s:
    webbrowser.open('http://localhost:8000');s.serve_forever()
