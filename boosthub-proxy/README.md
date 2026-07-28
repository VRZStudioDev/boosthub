# BoostHub Proxy QA/Staging Deploy

Pacote para testes autorizados de resiliência em ambiente controlado.

Escopo seguro deste pacote:

- Alvo padrão: `staging.api.ourapp.com`
- Webhook autenticado com `TOKEN_AQUI`
- Modo hold/release/drop apenas para simulação em staging
- Instalação isolada em `/opt/boosthub-proxy/`
- Sem alterações em containers existentes

## Arquivos gerados

Na VPS, os arquivos devem ficar nestes caminhos absolutos:

- `/opt/boosthub-proxy/scripts/proxy_handler.py`
- `/opt/boosthub-proxy/Dockerfile`
- `/opt/boosthub-proxy/docker-compose.yml`
- `/opt/boosthub-proxy/data/`
- `/opt/boosthub-proxy/logs/`

## 1. Preparar variáveis locais

No seu terminal local, ajuste apenas os placeholders:

```bash
export SSH_USER="USUARIO"
export VPS_HOST="IP_VPS"
export BOOSTHUB_PROXY_TOKEN="TOKEN_AQUI"
```

## 2. Criar estrutura na VPS

```bash
ssh "$SSH_USER@$VPS_HOST" 'sudo mkdir -p /opt/boosthub-proxy/{data,logs,scripts} && sudo chown -R $USER:$USER /opt/boosthub-proxy'
```

## 3. Copiar arquivos para a VPS

Execute a partir da raiz deste repo local:

```bash
scp boosthub-proxy/Dockerfile "$SSH_USER@$VPS_HOST:/opt/boosthub-proxy/Dockerfile"
scp boosthub-proxy/docker-compose.yml "$SSH_USER@$VPS_HOST:/opt/boosthub-proxy/docker-compose.yml"
scp boosthub-proxy/scripts/proxy_handler.py "$SSH_USER@$VPS_HOST:/opt/boosthub-proxy/scripts/proxy_handler.py"
```

## 4. Configurar placeholders na VPS

Este comando troca apenas o token placeholder no Compose. Mantenha o domínio em staging durante os testes.

```bash
ssh "$SSH_USER@$VPS_HOST" "cd /opt/boosthub-proxy && sed -i.bak \"s/TOKEN_AQUI/$BOOSTHUB_PROXY_TOKEN/g\" docker-compose.yml"
```

Se precisar alterar o host de staging autorizado, edite somente `TARGET_HOST`:

```bash
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && grep -n "TARGET_HOST\|WEBHOOK_TOKEN\|ORDER_PATH_PATTERN" docker-compose.yml'
```

## 5. Verificar conflitos antes do deploy

Como a VPS pode ter outros containers, rode as checagens antes de subir:

```bash
ssh "$SSH_USER@$VPS_HOST" 'docker ps --format "table {{.Names}}\t{{.Ports}}"'
ssh "$SSH_USER@$VPS_HOST" 'sudo ss -ltnp | grep -E ":(8080|8081)\b" || true'
```

Se `8080` já estiver em uso, não suba o container antes de mudar a porta publicada no `docker-compose.yml`.

## 6. Build e deploy

```bash
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && docker compose config'
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && docker compose build'
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && docker compose up -d'
```

## 7. Verificação de logs

```bash
ssh "$SSH_USER@$VPS_HOST" 'docker logs --tail=100 boosthub-proxy'
ssh "$SSH_USER@$VPS_HOST" 'curl -s http://127.0.0.1:8080/health | jq .'
ssh "$SSH_USER@$VPS_HOST" 'tail -n 50 /opt/boosthub-proxy/logs/proxy_audit.jsonl 2>/dev/null || true'
```

Saída esperada do health check:

```json
{
  "status": "ok",
  "target_host": "staging.api.ourapp.com",
  "pending_requests": 0
}
```

## 8. Teste do webhook com curl

Sem requisição pendente, o webhook deve responder `no_pending_request`:

```bash
curl -i -X POST "http://IP_VPS:8080/decision" \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"decision":"decline"}'
```

Resposta esperada sem fila:

```json
{"error":"no_pending_request"}
```

Teste de autorização inválida:

```bash
curl -i -X POST "http://IP_VPS:8080/decision" \
  -H "Authorization: Bearer TOKEN_ERRADO" \
  -H "Content-Type: application/json" \
  -d '{"decision":"accept"}'
```

Resposta esperada:

```json
{"error":"unauthorized"}
```

## 9. Simular hold/drop em staging via curl

Abra dois terminais SSH.

Terminal A: envie uma requisição pelo proxy. Ela deve ficar pendente até decisão ou timeout.

```bash
ssh "$SSH_USER@$VPS_HOST" 'curl -i --proxy http://127.0.0.1:8080 -X POST http://staging.api.ourapp.com/v1/orders/test-order/decline'
```

Terminal B: envie a decisão autenticada.

```bash
ssh "$SSH_USER@$VPS_HOST" 'curl -i -X POST http://127.0.0.1:8080/decision -H "Authorization: Bearer TOKEN_AQUI" -H "Content-Type: application/json" -d "{\"decision\":\"decline\"}"'
```

Para `decline`, o Terminal A deve receber HTTP `200` com payload de simulação QA.

Logs esperados:

```text
QA hold token=... host=staging.api.ourapp.com path=/v1/orders/test-order/decline ...
QA drop token=... decision=decline path=/v1/orders/test-order/decline ...
```

Eventos esperados em `/opt/boosthub-proxy/logs/proxy_audit.jsonl`:

```json
{"event":"request_held", ...}
{"event":"request_dropped", ...}
```

## 10. Instalar certificado no iPhone para tráfego de staging

Use este procedimento somente com tráfego autorizado de staging.

1. No Shadowrocket, adicione um servidor proxy:
   - Tipo: `HTTP`
   - Host: `IP_VPS`
   - Porta: `8080`
2. Ative temporariamente esse proxy no iPhone.
3. No Safari do iPhone, com o proxy ativo, acesse:

```text
http://mitm.it
```

4. Baixe o certificado para iOS.
5. Vá em Ajustes > Geral > VPN e Gerenciamento de Dispositivo e instale o perfil baixado.
6. Vá em Ajustes > Geral > Sobre > Ajustes de Confiança do Certificado.
7. Ative a confiança completa para o certificado do mitmproxy.
8. No Shadowrocket, limite a regra ao staging:

```text
DOMAIN,staging.api.ourapp.com,PROXY
FINAL,DIRECT
```

## 11. Interface web do mitmproxy

A interface `8081` está vinculada ao localhost da VPS por segurança. Para acessar localmente:

```bash
ssh -L 8081:127.0.0.1:8081 "$SSH_USER@$VPS_HOST"
```

Depois abra no navegador local:

```text
http://127.0.0.1:8081
```

## 12. Atualizar Atalho Siri em staging

No atalho de QA, substitua o controle de VPN por uma chamada HTTP:

Accept:

```text
POST http://IP_VPS:8080/decision
Authorization: Bearer TOKEN_AQUI
Content-Type: application/json

{"decision":"accept"}
```

Decline:

```text
POST http://IP_VPS:8080/decision
Authorization: Bearer TOKEN_AQUI
Content-Type: application/json

{"decision":"decline"}
```

## 13. Parar ou atualizar

Parar:

```bash
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && docker compose down'
```

Atualizar após editar arquivos:

```bash
ssh "$SSH_USER@$VPS_HOST" 'cd /opt/boosthub-proxy && docker compose up -d --build'
ssh "$SSH_USER@$VPS_HOST" 'docker logs --tail=100 boosthub-proxy'
```