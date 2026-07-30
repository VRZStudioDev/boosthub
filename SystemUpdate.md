📘 Guia de Implementação – Proxy MITM para BoostHub (Geração de "Excluded")

Versão: 1.0
Data: Julho de 2026
Autor: BoostHub Team
Status: Final – Pronto para Deploy

📑 Índice

Visão Geral da Arquitetura
Pré-requisitos
Configuração da VPS (Hostinger Ubuntu 22.04)
Configuração do Shadowrocket no iPhone
Atualização do Atalho Siri
Testes e Validação
Considerações de Produção
Solução de Problemas (Troubleshooting)
Comandos Rápidos
Próximos Passos
1. Visão Geral da Arquitetura

O novo sistema substitui o bloqueio local (REJECT) do Shadowrocket por um proxy MITM (Man-in-the-Middle) hospedado na sua VPS. Esse proxy intercepta as requisições de aceitação/recusa enviadas pelo app do OurApp, segura-as até que o motorista decida, e então:

Se o motorista aceitar: a requisição é liberada para o servidor do OurApp.
Se o motorista recusar (ou deixar o tempo passar): a requisição é descartada (nunca chega ao servidor). O OurApp interpreta isso como uma falha de comunicação e marca a ordem como "Excluded", sem penalizar a Acceptance Rate.
Fluxo de Dados

text
📱 iPhone (Shadowrocket)
        │
        ▼ (Tráfego HTTPS redirecionado)
🌐 VPS (mitmproxy + webhook)
        │
        ├── Intercepta requisição de aceitação/recusa
        ├── Aguarda decisão do motorista
        │
        ▼
📞 Decisão do motorista (via Siri → webhook)
        │
        ├── "Accept" → libera requisição → OurApp
        └── "Decline" → descarta requisição → OurApp nunca recebe
2. Pré-requisitos

Antes de começar, certifique-se de ter:

Item	Descrição
VPS	Hostinger Ubuntu 22.04 com Docker instalado (24GB RAM, 4 vCPUs).
Acesso SSH	Credenciais de acesso à VPS.
Domínio (opcional)	Para certificado SSL válido (Let's Encrypt).
iPhone	Com Shadowrocket instalado e conta Apple ativa.
Atalho Siri	Versão atual do "Check Order" (ou "Accept Order").
3. Configuração da VPS (Hostinger Ubuntu 22.04)

3.1. Conectar à VPS via SSH

bash
ssh usuario@ip_da_vps
3.2. Criar estrutura de pastas

bash
sudo mkdir -p /opt/boosthub-proxy/{data,logs,scripts}
cd /opt/boosthub-proxy
sudo chown -R $USER:$USER /opt/boosthub-proxy
3.3. Criar o script do mitmproxy

Crie o arquivo /opt/boosthub-proxy/scripts/proxy_handler.py com o conteúdo abaixo:

python
# /opt/boosthub-proxy/scripts/proxy_handler.py

import json
import time
import threading
from mitmproxy import http, ctx
from collections import deque

# Fila de requisições pendentes (primeira a entrar, primeira a ser atendida)
pending_requests = deque()
pending_lock = threading.Lock()
decision_cache = {}  # {order_token: "accept" | "decline"}

class OrderInterceptor:
    def request(self, flow: http.HTTPFlow) -> None:
        # Intercepta apenas POST para endpoints de aceitação/recusa do OurApp
        if "api-dasher.OurApp.com" in flow.request.pretty_host:
            if "/v1/orders/" in flow.request.path and ("accept" in flow.request.path or "decline" in flow.request.path):
                # Gera um identificador único para esta requisição
                order_token = f"{flow.client_conn.address[0]}_{flow.request.timestamp_start}_{len(pending_requests)}"
                ctx.log.info(f"Intercepted order: {order_token}")

                with pending_lock:
                    pending_requests.append({
                        "token": order_token,
                        "flow": flow,
                        "timestamp": time.time()
                    })

                # Intercepta a requisição (segura)
                flow.intercept()
                ctx.log.info(f"Request held. Pending: {len(pending_requests)}")

class DecisionWebhook:
    def request(self, flow: http.HTTPFlow) -> None:
        # Endpoint para receber decisões do atalho Siri
        if flow.request.pretty_host == "localhost" and flow.request.path == "/decision":
            try:
                data = json.loads(flow.request.content)
                decision = data.get("decision")  # "accept" ou "decline"
                ctx.log.info(f"Decision received: {decision}")

                with pending_lock:
                    if pending_requests:
                        # Pega a requisição mais antiga
                        pending = pending_requests.popleft()
                        order_token = pending["token"]
                        flow_obj = pending["flow"]

                        if decision == "accept":
                            # Libera a requisição para o servidor
                            flow_obj.resume()
                            ctx.log.info(f"Order {order_token} ACCEPTED")
                        elif decision == "decline":
                            # Descarta a requisição (responde com 200 OK)
                            flow_obj.response = http.HTTPResponse.make(
                                200,
                                b'{"status":"declined"}',
                                {"Content-Type": "application/json"}
                            )
                            ctx.log.info(f"Order {order_token} DECLINED (dropped)")
                        else:
                            ctx.log.warn(f"Unknown decision: {decision}")
                    else:
                        ctx.log.warn("No pending order to process")

                flow.response = http.HTTPResponse.make(
                    200,
                    b'{"status":"ok"}',
                    {"Content-Type": "application/json"}
                )
            except Exception as e:
                ctx.log.error(f"Error processing decision: {e}")
                flow.response = http.HTTPResponse.make(
                    500,
                    b'{"error":"internal error"}',
                    {"Content-Type": "application/json"}
                )

# Registro dos addons
addons = [
    OrderInterceptor(),
    DecisionWebhook()
]
3.4. Criar o Dockerfile

Crie o arquivo /opt/boosthub-proxy/Dockerfile:

dockerfile
FROM mitmproxy/mitmproxy:latest

WORKDIR /app
COPY scripts/ /app/scripts/

EXPOSE 8080 8081

CMD ["mitmdump", "-s", "/app/scripts/proxy_handler.py", "--listen-host", "0.0.0.0", "--listen-port", "8080", "--web-host", "0.0.0.0", "--web-port", "8081", "--ssl-insecure"]
3.5. Criar o docker-compose.yml

Crie o arquivo /opt/boosthub-proxy/docker-compose.yml:

yaml
version: '3.8'

services:
  mitmproxy:
    build: .
    container_name: boosthub-proxy
    ports:
      - "8080:8080"   # Proxy HTTP/HTTPS
      - "8081:8081"   # Web interface (para download do certificado)
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    environment:
      - MITMPROXY_SSL_INSECURE=true
    command: mitmdump -s /app/scripts/proxy_handler.py --listen-host 0.0.0.0 --listen-port 8080 --web-host 0.0.0.0 --web-port 8081 --ssl-insecure
3.6. Construir e rodar o container

bash
cd /opt/boosthub-proxy
docker-compose up -d
3.7. Verificar logs

bash
docker logs -f boosthub-proxy
3.8. (Opcional) Configurar reinicialização automática

O Docker Compose já possui restart: unless-stopped. Para garantir que o container suba com o sistema:

bash
sudo systemctl enable docker
4. Configuração do Shadowrocket no iPhone

4.1. Obter o certificado do proxy

No navegador do iPhone, acesse: http://SEU_IP_VPS:8081
Clique em "Download Certificate".
Vá em Ajustes > Geral > Perfil e instale o certificado.
Vá em Ajustes > Geral > Sobre > Configurações de Certificado e ative a confiança para o certificado do mitmproxy.
4.2. Configurar servidor proxy no Shadowrocket

Abra o Shadowrocket.
Vá em "Servidores" → "Adicionar Servidor".
Configure:
Tipo: HTTP (ou HTTPS, se você configurar SSL no proxy)
Host: SEU_IP_VPS
Porta: 8080
Salve e selecione este servidor como ativo.
(Recomendado) Ative o proxy apenas para domínios do OurApp:
Em "Config" → "Rule", adicione:
DOMAIN-SUFFIX,OurApp.com,PROXY
Deixe FINAL,DIRECT para todo o resto.
5. Atualização do Atalho Siri

5.1. Modificações no atalho existente

O atalho atual pergunta amount e distance, chama analyze-order, fala o reason, e pergunta a decisão. Agora, em vez de controlar o Shadowrocket, ele deve enviar a decisão para o webhook do proxy.

Etapas:

No bloco If Ask for Input is "Accept":
Substitua a ação de registro (telegram-voice-command) por uma chamada ao webhook.
Ação: Obter Conteúdo de URL
URL: http://SEU_IP_VPS:8080/decision
Método: POST
Headers: Content-Type: application/json
Body (JSON):
json
{
  "decision": "accept"
}
No bloco Else If Ask for Input is "Decline":
Remova as ações Open URL: shadowrocket://connect, Wait, Open URL: shadowrocket://disconnect.
Adicione a mesma ação de Obter Conteúdo de URL para o webhook, mas com "decision": "decline".
Adicione uma ação Speak Text após cada chamada para confirmar:
"Acceptance sent to server."
"Decline sent to server. Order will be excluded."
5.2. Exemplo do body JSON para o webhook

json
{
  "decision": "decline"
}
6. Testes e Validação

6.1. Teste unitário do proxy (local)

bash
curl -X POST http://SEU_IP_VPS:8080/decision -H "Content-Type: application/json" -d '{"decision":"decline"}'
6.2. Teste integrado com o iPhone

Ative o Shadowrocket (com proxy configurado).
Abra o OurApp e receba uma ordem.
Use o atalho Siri para decidir "Decline".
Verifique os logs do proxy:
bash
docker logs -f boosthub-proxy
Deve aparecer: Intercepted order: ... e DECLINED (dropped).
Verifique no OurApp:
A ordem deve desaparecer sem afetar sua Acceptance Rate.
6.3. Validar "Excluded"

Após o teste, acesse o Dashboard do OurApp (ou o aplicativo) e verifique se a Acceptance Rate permanece inalterada. A ordem não deve aparecer como "recusada" ou "perdida".

7. Considerações de Produção

Aspecto	Recomendação
Persistência	Use Redis no lugar da fila em memória para lidar com múltiplas requisições e reinicializações.
Autenticação	Adicione um token secreto no webhook (?token=...) para evitar chamadas maliciosas.
Logs	Armazene logs em arquivo (volume Docker) para auditoria.
SSL	Substitua o certificado self-signed por um certificado válido (Let's Encrypt) no proxy.
Monitoramento	Configure um endpoint /health para verificar o status do proxy.
Escalabilidade	O proxy é stateless (exceto pela fila), portanto, pode ser replicado com um balanceador de carga.
8. Solução de Problemas (Troubleshooting)

Problema	Solução
Shadowrocket não conecta	Verifique o IP e porta do proxy. Certifique-se de que o firewall da VPS permite a porta 8080.
Erro de certificado no iPhone	Reinstale o certificado e ative a confiança em Ajustes.
Requisição não é interceptada	Verifique se o Shadowrocket está roteando o tráfego para o proxy (use modo global para teste).
Webhook não recebe decisão	Verifique se o atalho está usando a URL correta (http://SEU_IP_VPS:8080/decision) e o método POST.
Proxy não inicia	Verifique logs com docker logs boosthub-proxy. Certifique-se de que o arquivo proxy_handler.py não tem erros de sintaxe.
Múltiplas ordens em fila	O proxy processa uma por vez. Para produção, use Redis para fila mais robusta.
9. Comandos Rápidos

Subir o proxy

bash
cd /opt/boosthub-proxy
docker-compose up -d
Ver logs

bash
docker logs -f boosthub-proxy
Reiniciar o proxy

bash
docker-compose restart
Parar o proxy

bash
docker-compose down
Atualizar o script do proxy

Edite /opt/boosthub-proxy/scripts/proxy_handler.py.
Reconstrua e reinicie:
bash
docker-compose up -d --build
10. Próximos Passos

Implemente o proxy na sua VPS seguindo este guia.
Teste com um iPhone (use um amigo ou beta tester).
Atualize o manual para os beta testers com as novas instruções (sem force-quit).
Valide se o "Excluded" está sendo gerado corretamente.
Refine a lógica do proxy para lidar com múltiplas requisições simultâneas (use Redis).
Configure SSL válido para o proxy (recomendado para produção).