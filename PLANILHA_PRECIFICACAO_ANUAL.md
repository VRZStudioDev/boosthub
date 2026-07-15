| <img src="public/bg.jpg" alt="BoostHub" width="120" /> | **BoostHub**<br>Desenvolvedor: Denis W. Bonaccini |
| --- | --- |

## Planilha de Precificacao Anual (Custos Operacionais)

Para suportar 3.000 usuarios ativos com alta performance, seguranca e funcionalidades extras (CMS/LMS), dividimos a infraestrutura em 3 pilares:

**Observacao:** os custos de infraestrutura abaixo sao apresentados apenas no formato anual, pois VPS e licencas possuem melhor precificacao nesse modelo. Valores mensais sao usados apenas como referencia para margem/receita.

| Item | Especificacao Tecnica | Custo Anual |
| --- | --- | ---: |
| 1. VPS Principal (App + Proxy + CMS/LMS) | 8 vCPU, 16 GB RAM, 200 GB SSD (NVMe). Hospeda a aplicacao React/Node, o Proxy reverso (Nginx/HAProxy) para balanceamento de carga, rate-limiting e termino SSL, alem do Headless CMS (Strapi) para gerenciar conteudos de treinamento. | R$ 3.948,00 |
| 2. VPS Secundario (Banco + Cache) | 4 vCPU, 8 GB RAM, 100 GB SSD. Dedicado exclusivamente ao PostgreSQL (com conexoes preparadas para 3k usuarios) e Redis para cache de sessoes, filas de background e armazenamento de respostas da API (reduzindo latencia). | R$ 1.188,00 |
| 3. Cloudflare Proxy + WAF + CDN | Plano Pro anual. Atua como Proxy reverso global, esconde o IP da origem, aplica regras de firewall (WAF) contra ataques DDoS/brute-force, e faz cache de assets estaticos (imagens, videos dos treinamentos) para entrega rapida nos EUA. | R$ 443,00 |
| **TOTAL GERAL (1 ANO)** | **Infraestrutura pronta para escala** | **R$ 5.579,00** |

*(Contas exatas: 3.948 + 1.188 + 443 = 5.579)*

---

## Justificativa Tecnica e Estrategica (O que justifica esse valor?)

### 1. Por que um Proxy separado / Cloudflare?

Com 3 mil usuarios ativos, voce tera picos de requisicoes simultaneas (ex: ao baterem o ponto ou dispararem os atalhos por voz). Sem um proxy, seu VPS principal sofreria com ataques de scraping, conexoes TCP exaustas e lentidao. O Proxy + WAF:

- Faz rate-limiting por usuario (evita abuso da API).
- Mantem keep-alive e compressao Brotli/Gzip, economizando banda.
- Garante 99,99% de uptime redirecionando trafego em caso de falha do VPS.

### 2. Por que um CMS/LMS (Strapi) no VPS principal?

O app nao e so um rastreador; ele vira uma plataforma de capacitacao. Incluimos um LMS (Learning Management System) para os motoristas:

- Cursos rapidos sobre "Como calcular frete com margem de lucro" e "Dicas para reducao de IPVA/combustivel".
- Questionarios gamificados que geram bonus na plataforma.
- Central de comunicados e manuais (CMS).

Isso justifica o preco final do seu SaaS (voce pode cobrar mais caro do que concorrentes que so oferecem planilhas) e exige mais CPU/RAM, dai a necessidade do VPS de 8 vCPU.

### 3. Banco de dados separado (VPS Secundario)

Com 3k usuarios gravando usage_logs diariamente (cada motorista pode gerar 50+ logs/dia), o I/O de disco ficaria muito alto. Separar o PostgreSQL e o Redis em um VPS dedicado:

- Elimina contencao de recursos com a aplicacao.
- Permite fazer snapshots diarios (backup) sem afetar a performance do app.
- O Redis guarda as sessoes de autenticacao (magic link) e respostas de custo-por-milha em cache, deixando a resposta para o usuario em < 200ms.

---

## Cenario de Receita vs. Custo (Base Anual)

| Metrica | Calculo |
| --- | --- |
| Custo operacional anual | R$ 5.579,00 |
| Preco de referencia para margem (mensal) | US$ 79.90 por usuario |
| Receita anual por usuario (referencia) | US$ 958.80 (79.90 x 12) |
| Receita anual com 3.000 usuarios | US$ 2,876,400.00 |
| Usuarios necessarios para pagar a infraestrutura | Formula: R$ 5.579,00 / (US$ 958.80 x cambio BRL/USD) |
