FROM mitmproxy/mitmproxy:latest

WORKDIR /app

COPY scripts/ /app/scripts/

EXPOSE 8080 8081

CMD ["mitmweb", "-s", "/app/scripts/proxy_handler.py", "--listen-host", "0.0.0.0", "--listen-port", "8080", "--web-host", "0.0.0.0", "--web-port", "8081", "--ssl-insecure"]