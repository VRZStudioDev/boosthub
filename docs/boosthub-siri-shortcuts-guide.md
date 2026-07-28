# Guia BoostHub: Atalhos de Voz da Siri

Manual prático para criar atalhos de voz da Siri que analisam pedidos no BoostHub, falam a decisão em voz alta e, opcionalmente, registram decisões via Telegram.

Idiomas cobertos:

- Inglês
- Português
- Espanhol

---

## Recomendação rápida (English-first)

- Build and validate English shortcut first.
- Duplicate to PT and ES only after EN works.
- Localize only shortcut name, Siri phrase, and user-facing prompts.
- Keep endpoint, method, header, and JSON keys unchanged (`voice_token`, `amount`, `distance`).
- Export one iCloud link per language and version.

| Idioma | Nome sugerido | Frase de ativação |
| --- | --- | --- |
| English | Accept Order | Hey Siri, Accept order |
| Português | Aceitar Corrida | Ei Siri, Aceitar corrida |
| Español | Aceptar Pedido | Oye Siri, Aceptar pedido |

---

## 1. Informações necessárias antes de começar

Você precisa ter estes valores:

```text
URL_ANALYZE_ORDER
VOICE_TOKEN_DO_USUARIO
URL_DECLINE_TELEGRAM
```

### URL de análise

Use este endpoint:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

### Método HTTP

```text
POST
```

### Header obrigatório

```text
Content-Type: application/json
```

### Body JSON

```json
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": 6.50,
  "distance": 3.0
}
```

### Campos fixos

Estes nomes não devem ser alterados:

```text
voice_token
amount
distance
```

### Campos que o usuário deve substituir

```text
VOICE_TOKEN_DO_USUARIO
```

Substituir pelo token pessoal exibido no Dashboard do BoostHub.

```text
amount
```

Valor do pedido/corrida.

```text
distance
```

Distância em milhas.

---

## 2. Atalho base em inglês (recomendado)

### Nome sugerido

```text
Accept Order
```

### Frase de ativação

```text
Hey Siri, Accept order
```

### Step-by-step

1. Open the **Shortcuts** app on your iPhone.
2. Tap **+** to create a new shortcut.
3. Tap the shortcut name at the top.
4. Rename it to:

```text
Accept Order
```

5. Tap **Add Action**.
6. Search for:

```text
Ask for Input
```

7. Add **Ask for Input**.
8. Configure it like this:

```text
Prompt: Order amount?
Input Type: Number
```

9. Rename the answer variable to:

```text
Amount
```

10. Add another **Ask for Input** action.
11. Configure it like this:

```text
Prompt: Distance in miles?
Input Type: Number
```

12. Rename this variable to:

```text
Distance
```

13. Add the **Text** action.
14. Paste this JSON:

```json
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": AMOUNT_HERE,
  "distance": DISTANCE_HERE
}
```

15. Replace `VOICE_TOKEN_DO_USUARIO` with the user's real token.
16. Replace `AMOUNT_HERE` with the **Amount** variable.
17. Replace `DISTANCE_HERE` with the **Distance** variable.
18. Add **Get Contents of URL**.
19. In the URL field, paste:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

20. Expand the action options.
21. Configure it like this:

```text
Method: POST
Request Body: File
```

22. In **Headers**, add:

```text
Key: Content-Type
Value: application/json
```

23. For the request body, select the JSON text created above.
24. Add **Get Dictionary from Input**.
25. Add **Get Dictionary Value**.
26. Configure it to get:

```text
reason
```

27. Add **Speak Text**.
28. Use the `reason` value as the spoken text.
29. Save the shortcut.
30. Test it by saying:

```text
Hey Siri, Accept order
```

### Optional: register decline

31. Add **Get Dictionary Value** to get:

```text
decision
```

32. Add an **If** action.
33. Configure it like this:

```text
If decision is decline
```

34. Inside the `If` block, add **Get Contents of URL**.
35. Use your decline URL:

```text
URL_DECLINE_TELEGRAM
```

Example:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/telegram-voice-command?token=VOICE_TOKEN_DO_USUARIO&decision=decline&amount=AMOUNT
```

36. Replace `VOICE_TOKEN_DO_USUARIO` with the real token.
37. Replace `AMOUNT` with the **Amount** variable.

---

## 3. Atalho em português

### Nome sugerido

```text
Aceitar Corrida
```

### Frase de ativação

```text
E aí Siri, Aceitar corrida
```

Também pode funcionar melhor como:

```text
Ei Siri, Aceitar corrida
```

> Recomendação: duplique o atalho em inglês já validado e traduza apenas o nome, a frase da Siri e os prompts que aparecem para o usuário. Mantenha o endpoint, o método, o header e o payload JSON idênticos. Não altere as chaves `voice_token`, `amount` e `distance`.

### Passo a passo

1. Abra o app **Atalhos**.
2. Toque em **+**.
3. Toque no nome do atalho.
4. Renomeie para:

```text
Aceitar Corrida
```

5. Toque em **Adicionar Ação**.
6. Pesquise por:

```text
Pedir Entrada
```

7. Adicione **Pedir Entrada**.
8. Configure:

```text
Pergunta: Qual o valor da corrida?
Tipo de entrada: Número
```

9. Renomeie a variável para:

```text
Valor
```

10. Adicione outra ação **Pedir Entrada**.
11. Configure:

```text
Pergunta: Qual a distância em milhas?
Tipo de entrada: Número
```

12. Renomeie a variável para:

```text
Distância
```

13. Adicione a ação **Texto**.
14. Cole:

```json
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": VALOR_AQUI,
  "distance": DISTANCIA_AQUI
}
```

15. Substitua `VOICE_TOKEN_DO_USUARIO` pelo token real.
16. Substitua `VALOR_AQUI` pela variável **Valor**.
17. Substitua `DISTANCIA_AQUI` pela variável **Distância**.
18. Adicione **Obter Conteúdo de URL**.
19. No campo URL, cole:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

20. Expanda as opções.
21. Configure:

```text
Método: POST
Corpo da solicitação: Arquivo
```

22. Em Cabeçalhos, adicione:

```text
Chave: Content-Type
Valor: application/json
```

23. Configure o corpo como o texto JSON criado.
24. Adicione **Obter Dicionário da Entrada**.
25. Adicione **Obter Valor do Dicionário**.
26. Busque:

```text
reason
```

27. Adicione **Falar Texto**.
28. Use o valor de `reason` como texto falado.
29. Salve o atalho.
30. Teste dizendo:

```text
E aí Siri, Aceitar corrida
```

ou:

```text
Ei Siri, Aceitar corrida
```

### Opcional: registrar decline

31. Busque também o campo:

```text
decision
```

32. Adicione uma ação **Se**.
33. Configure:

```text
Se decision é decline
```

34. Dentro desse bloco, adicione **Obter Conteúdo de URL**.
35. Use:

```text
URL_DECLINE_TELEGRAM
```

36. Substitua o token pelo token real.
37. Substitua o valor do amount pela variável **Valor**.

---

## 4. Atalho em espanhol

### Nome sugerido

```text
Aceptar Pedido
```

### Frase de ativação

```text
Oye Siri, Aceptar pedido
```

Também pode funcionar como:

```text
Hey Siri, Aceptar pedido
```

> Recomendación: duplica primero el atajo en inglés ya validado y traduce solo el nombre, la frase de Siri y los prompts visibles para el usuario. Mantén el endpoint, el método, el header y el payload JSON idénticos. No cambies las claves `voice_token`, `amount` y `distance`.

### Paso a paso

1. Abre la app **Atajos**.
2. Toca **+**.
3. Toca el nombre del atajo.
4. Renómbralo como:

```text
Aceptar Pedido
```

5. Toca **Agregar acción**.
6. Busca:

```text
Solicitar entrada
```

7. Agrega **Solicitar entrada**.
8. Configura:

```text
Pregunta: ¿Cuál es el valor del pedido?
Tipo de entrada: Número
```

9. Renombra la variable como:

```text
Valor
```

10. Agrega otra acción **Solicitar entrada**.
11. Configura:

```text
Pregunta: ¿Cuál es la distancia en millas?
Tipo de entrada: Número
```

12. Renombra la variable como:

```text
Distancia
```

13. Agrega la acción **Texto**.
14. Pega:

```json
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": VALOR_AQUI,
  "distance": DISTANCIA_AQUI
}
```

15. Sustituye `VOICE_TOKEN_DO_USUARIO` por el token real.
16. Sustituye `VALOR_AQUI` por la variable **Valor**.
17. Sustituye `DISTANCIA_AQUI` por la variable **Distancia**.
18. Agrega **Obtener contenido de URL**.
19. En el campo URL, pega:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

20. Expande las opciones.
21. Configura:

```text
Método: POST
Cuerpo de la solicitud: Archivo
```

22. En encabezados, agrega:

```text
Clave: Content-Type
Valor: application/json
```

23. Usa como cuerpo el texto JSON creado arriba.
24. Agrega **Obtener diccionario de entrada**.
25. Agrega **Obtener valor de diccionario**.
26. Busca:

```text
reason
```

27. Agrega **Leer texto** o **Hablar texto**.
28. Usa el valor de `reason`.
29. Guarda el atajo.
30. Prueba diciendo:

```text
Oye Siri, Aceptar pedido
```

### Opcional: registrar decline

31. Busca también:

```text
decision
```

32. Agrega una condición:

```text
Si decision es decline
```

33. Dentro de la condición, usa **Obtener contenido de URL** con:

```text
URL_DECLINE_TELEGRAM
```

34. Sustituye el token y el amount por la variable **Valor**.

---

## 5. Estrutura correta do payload

Use sempre:

```json
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": 6.50,
  "distance": 3.0
}
```

### Campos fixos

```text
voice_token
amount
distance
```

### Campos variáveis

```text
VOICE_TOKEN_DO_USUARIO
```

Token pessoal do usuário.

```text
amount
```

Valor do pedido/corrida.

```text
distance
```

Distância em milhas.

---

## 6. Resposta esperada do BoostHub

Exemplo:

```json
{
  "decision": "accept",
  "reason": "You're making $2.03/mile — worth it!",
  "net_payout": 6.08,
  "savings": 0,
  "fuel_cost": 0.42,
  "per_mile": 2.03
}
```

### Campos importantes

```text
decision
```

Pode ser:

```text
accept
decline
marginal
```

```text
reason
```

Frase que a Siri deve falar.

```text
per_mile
```

Ganho líquido por milha.

```text
net_payout
```

Valor líquido estimado depois do custo de combustível.

---

## 7. Como compartilhar o atalho via iCloud Link

1. Abra o app **Atalhos**.
2. Encontre o atalho.
3. Toque nos três pontinhos `...`.
4. Toque no botão de compartilhamento.
5. Escolha:

```text
Copy iCloud Link
```

ou:

```text
Copiar link do iCloud
```

6. Envie o link para o usuário.

---

## 8. Como o destinatário importa o atalho

1. Abrir o link no iPhone.
2. Tocar em:

```text
Get Shortcut
```

ou:

```text
Obter Atalho
```

3. Tocar em:

```text
Add Shortcut
```

ou:

```text
Adicionar Atalho
```

4. Abrir o atalho importado.
5. Substituir o token antigo pelo próprio token.
6. Confirmar que o endpoint está correto:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

7. Confirmar que o método é:

```text
POST
```

8. Confirmar que o header é:

```text
Content-Type: application/json
```

9. Testar com um valor real.

---

## 9. O que editar após importar

Obrigatório:

```text
VOICE_TOKEN_DO_USUARIO
```

Trocar pelo token próprio.

Obrigatório:

```text
URL_ANALYZE_ORDER
```

Confirmar:

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
```

Obrigatório:

```text
Body JSON
```

Confirmar:

```json
{
  "voice_token": "TOKEN_DO_USUARIO",
  "amount": Amount,
  "distance": Distance
}
```

Opcional:

```text
URL_DECLINE_TELEGRAM
```

Usar apenas se quiser registrar decline automaticamente.

---

## 10. Como versionar atalhos

Use nomes com versão no final.

Exemplos:

```text
Accept Order v1
Accept Order v2
Aceitar Corrida v1
Aceitar Corrida v2
Aceptar Pedido v1
Aceptar Pedido v2
```

### Quando criar nova versão

Crie nova versão quando mudar:

1. Endpoint.
2. Campos do JSON.
3. Nome das variáveis.
4. Lógica de decline.
5. Texto falado pela Siri.

### Processo recomendado

1. Duplique o atalho atual.
2. Renomeie a cópia, por exemplo:

```text
Accept Order v2
```

3. Faça as mudanças na cópia.
4. Teste no seu iPhone.
5. Gere novo iCloud Link.
6. Envie o novo link para os usuários.
7. Avise:

```text
Please replace the old shortcut with this new version.
```

---

## 11. Checklist de validação pós-importação

### Teste 1: requisição com amount e distance válidos

Use:

```text
amount: 6.50
distance: 3.0
```

Resultado esperado:

```text
O atalho recebe uma resposta do BoostHub sem erro.
```

### Teste 2: retorno falado pela Siri

A Siri deve falar algo parecido com:

```text
You're making $2.03/mile — worth it!
```

Se a Siri não falar nada, confira se a ação **Speak Text / Falar Texto / Leer texto** está usando o campo `reason`.

### Teste 3: atualização no Dashboard

Depois de rodar o atalho:

1. Abra o Dashboard do BoostHub.
2. Veja o card:

```text
Last Voice Assistant
```

3. Confirme que ele mostra:

```text
Status
Decision
Net payout
Per mile
Message
Timestamp
```

Se você também usou a URL de decline, veja:

```text
Last Voice Command
```

### Teste 4: fallback de token inválido

Troque temporariamente o token por:

```text
TOKEN_INVALIDO
```

Execute o atalho.

Resultado esperado:

```text
Erro de token inválido
```

Depois volte o token correto.

---

## 12. Troubleshooting

### Erro: token inválido

Causa provável:

```text
VOICE_TOKEN_DO_USUARIO está errado ou foi regenerado.
```

Como resolver:

1. Abra o Dashboard.
2. Vá em Settings.
3. Abra Voice Assistant.
4. Copie o token atual.
5. Cole no atalho novamente.
6. Teste de novo.

### Erro: método incorreto

Causa provável:

```text
A ação Get Contents of URL não está usando POST.
```

Como resolver:

1. Abra o atalho.
2. Encontre **Get Contents of URL**.
3. Expanda as opções.
4. Altere Method para:

```text
POST
```

### Erro: header incorreto

Causa provável:

```text
Content-Type não foi configurado.
```

Como resolver:

1. Abra a ação **Get Contents of URL**.
2. Vá em Headers.
3. Adicione:

```text
Content-Type
application/json
```

Não use `Authorization` para o endpoint `analyze-order`.

### Siri não reconhece a frase em inglês

Tente encurtar o nome:

```text
Accept
```

Depois diga:

```text
Hey Siri, Accept
```

### Siri não reconhece a frase em português

Tente:

```text
Aceitar
```

ou:

```text
Corrida
```

Depois diga:

```text
Ei Siri, Aceitar
```

### Siri não reconhece a frase em espanhol

Tente:

```text
Aceptar
```

ou:

```text
Pedido
```

Depois diga:

```text
Oye Siri, Aceptar
```

### Atalho importado não executa chamada HTTP

Verifique:

1. O iPhone tem internet.
2. O endpoint está correto.
3. O método está como `POST`.
4. O header está como `Content-Type: application/json`.
5. O body contém `voice_token`, `amount` e `distance`.
6. O token não foi regenerado.

### Como depurar resposta JSON no Atalhos

1. Depois de **Get Contents of URL**, adicione:

```text
Quick Look
```

ou:

```text
Visualização Rápida
```

ou:

```text
Vista rápida
```

2. Execute o atalho.
3. O iPhone mostrará a resposta JSON.

Mensagens comuns:

```json
{"error":"Invalid voice_token."}
```

Token errado.

```json
{"error":"Missing voice_token."}
```

Campo `voice_token` não foi enviado.

```json
{"error":"amount must be a positive number."}
```

Valor inválido.

```json
{"error":"distance must be a positive number."}
```

Distância inválida.

---

## 13. Modelo final do atalho

```text
Ask for Input: Order amount?
Ask for Input: Distance in miles?
Text:
{
  "voice_token": "VOICE_TOKEN_DO_USUARIO",
  "amount": Amount,
  "distance": Distance
}

Get Contents of URL:
URL: https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
Method: POST
Header:
Content-Type: application/json
Body: Text

Get Dictionary from Input
Get Dictionary Value: reason
Speak Text: reason
```

Opcional:

```text
Get Dictionary Value: decision

If decision is decline:
  Get Contents of URL:
  URL_DECLINE_TELEGRAM
```

---

## 14. Resumo para enviar aos usuários

```text
1. Instale o atalho pelo iCloud Link.
2. Abra o atalho no app Atalhos.
3. Substitua VOICE_TOKEN_DO_USUARIO pelo seu token do Dashboard.
4. Confirme que o endpoint é:
   https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
5. Confirme que o método é POST.
6. Confirme que o header é Content-Type: application/json.
7. Rode um teste com amount 6.50 e distance 3.0.
8. Se a Siri falar a recomendação, está pronto.
```

---

## 15. Fluxo real de decisão (Accept e Decline)

Este fluxo separa a recomendação do sistema e a ação real do motorista, para manter os logs corretos.

1. A Siri coleta `amount` e `distance`.
2. O atalho chama o endpoint `analyze-order`.
3. O BoostHub retorna uma sugestão: `accept`, `decline` ou `marginal`.
4. A Siri lê o campo `reason` para ajudar na decisão.
5. Depois que o motorista realmente decide no app de entrega, o atalho registra a ação real no endpoint `telegram-voice-command`.
6. O bot grava a decisão real em `usage_logs` com `source = voice`.

### Observação importante

A recomendação do `analyze-order` não deve ser registrada automaticamente como ação final. O registro final deve refletir o que o motorista realmente fez.

---

### URLs para registrar ação real

#### Accept real

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/telegram-voice-command?token=VOICE_TOKEN_DO_USUARIO&decision=accept&amount=AMOUNT
```

#### Decline real

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/telegram-voice-command?token=VOICE_TOKEN_DO_USUARIO&decision=decline&amount=AMOUNT
```

Substituir:

```text
VOICE_TOKEN_DO_USUARIO
```

pelo token pessoal.

```text
AMOUNT
```

pelo valor real do pedido.

---

### Lógica recomendada no atalho (evita falso log)

1. Receber a resposta do `analyze-order`.
2. Ler `decision_sugerida` e `reason`.
3. Falar `reason`.
4. Perguntar confirmação da ação real:

```text
Did you accept this order?
```

```text
Did you decline this order?
```

5. Só chamar `telegram-voice-command` após confirmação do usuário.
6. Se o usuário cancelar, não registrar nada.

---

### Padrão multilíngue (English-first)

#### English

```text
Prompt: Did you accept this order?
Prompt: Did you decline this order?
```

#### Português

```text
Prompt: Você aceitou esta corrida?
Prompt: Você recusou esta corrida?
```

#### Español

```text
Prompt: Aceptaste este pedido?
Prompt: Rechazaste este pedido?
```

### Regra fixa para os 3 idiomas

Não mudar endpoint, método, header e chaves JSON. Traduzir apenas nome do atalho, frase de ativação e prompts visíveis ao usuário.

---

### Checklist rápido de validação

1. `analyze-order` responde sem erro.
2. Siri fala o campo `reason`.
3. Accept confirmado gera log de `accept`.
4. Decline confirmado gera log de `decline`.
5. Dashboard atualiza **Last Voice Command** após cada ação real.

---

## 16. Fluxo Unificado por Idioma

Use esta arquitetura para os 3 atalhos. O motor técnico é o mesmo; só mudam nome, frase da Siri e prompts visíveis ao usuário.

### Arquitetura recomendada: 3 atalhos, mesmo motor

| Idioma | Nome do atalho | Exemplo de frase Siri |
| --- | --- | --- |
| EN | Accept Order | Hey Siri, Accept order |
| PT | Aceitar Corrida | Ei Siri, Aceitar corrida |
| ES | Aceptar Pedido | Oye Siri, Aceptar pedido |

Todos os atalhos usam exatamente:

```text
Endpoint: https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/analyze-order
Method: POST
Header: Content-Type: application/json
JSON keys: voice_token, amount, distance
```

---

### Fluxo único dentro de cada atalho

1. Perguntar o valor do pedido.
2. Perguntar a distância em milhas.
3. Montar o JSON com `voice_token`, `amount` e `distance`.
4. Chamar `analyze-order` via `POST`.
5. Extrair `decision` e `reason` da resposta.
6. Falar `reason` em voz alta.
7. Fazer branch por `decision`:
   - Se `decision = accept`, perguntar confirmação real do motorista.
   - Se o motorista confirmou `accept`, registrar `accept` no `telegram-voice-command`.
   - Se `decision = decline`, perguntar confirmação real do motorista.
   - Se o motorista confirmou `decline`, registrar `decline` no `telegram-voice-command`.
   - Se `decision = marginal`, perguntar escolha final: `Accept`, `Decline` ou `Skip`.
8. Mostrar ou falar o retorno final:
   - decisão registrada; ou
   - nenhuma decisão registrada.

### Regra importante

A recomendação do BoostHub é apenas uma sugestão. O log final deve registrar somente o que o motorista realmente fez.

---

### Tratamento de Marginal (crítico)

Nunca registre `marginal` automaticamente como `accept` ou `decline`.

Quando `decision = marginal`, o atalho deve abrir escolha explícita:

```text
Accept
Decline
Skip
```

Resultado esperado:

- `Accept` registra `accept`.
- `Decline` registra `decline`.
- `Skip` não registra nada.

---

### Ação de rede opcional

Qualquer ação de rede configurada pelo usuário deve ser tratada como opcional e explícita.

Regras:

1. Não executar ação de rede automaticamente de forma oculta.
2. Só executar ação de rede após confirmação manual do usuário.
3. Registrar a decisão final separadamente de qualquer ação de rede.
4. Se não houver confirmação, não executar ação de rede e não registrar decisão.

Este guia não exige nenhuma ação de rede para que o fluxo de análise e registro funcione.

---

### URLs para registrar ação real

#### Accept real

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/telegram-voice-command?token=VOICE_TOKEN_DO_USUARIO&decision=accept&amount=AMOUNT
```

#### Decline real

```text
https://fphnymigmwqxsrghzvip.supabase.co/functions/v1/telegram-voice-command?token=VOICE_TOKEN_DO_USUARIO&decision=decline&amount=AMOUNT
```

Substituir:

```text
VOICE_TOKEN_DO_USUARIO
```

pelo token pessoal.

```text
AMOUNT
```

pelo valor real do pedido.

---

### Lógica recomendada no Atalhos

Depois de receber a resposta do `analyze-order`:

1. Salvar `decision` em uma variável chamada `Suggested Decision`.
2. Salvar `reason` em uma variável chamada `Reason`.
3. Usar **Speak Text** para falar `Reason`.
4. Criar condição:

```text
If Suggested Decision is accept
```

5. Perguntar ao usuário se ele realmente aceitou.
6. Se confirmou, chamar a URL de `accept`.
7. Criar condição:

```text
If Suggested Decision is decline
```

8. Perguntar ao usuário se ele realmente recusou.
9. Se confirmou, chamar a URL de `decline`.
10. Criar condição:

```text
If Suggested Decision is marginal
```

11. Perguntar escolha final: `Accept`, `Decline` ou `Skip`.
12. Registrar somente quando a escolha for `Accept` ou `Decline`.
13. Se escolher `Skip`, não registrar nada.

---

### Mapa de prompts por idioma

#### EN

```text
Did you accept this order?
Did you decline this order?
This is marginal. What did you do? Accept, Decline, or Skip?
```

#### PT

```text
Você aceitou esta corrida?
Você recusou esta corrida?
Pedido marginal. O que você fez? Aceitar, Recusar ou Pular?
```

#### ES

```text
Aceptaste este pedido?
Rechazaste este pedido?
Pedido marginal. Qué hiciste? Aceptar, Rechazar o Omitir?
```

---

### Regras fixas nos 3 atalhos

Não alterar:

```text
Endpoint
Method: POST
Header: Content-Type: application/json
JSON keys: voice_token, amount, distance
```

Pode traduzir:

```text
Nome do atalho
Frase de ativação da Siri
Prompts visíveis ao usuário
Texto final falado pela Siri
```

---

### Checklist de aprovação

- Segurança: nenhuma decisão final é registrada sem confirmação real do motorista.
- Backward Compatibility: endpoint, método, header e chaves JSON continuam iguais.
- Documentação: EN é o atalho base; PT e ES são duplicações localizadas.
- Testes Unitários: validar branches `accept`, `decline` e `marginal` em cenário real.
- `analyze-order` responde corretamente para payload válido.
- `reason` é falado pela Siri.
- `accept` confirmado gera log de `accept` com `source = voice`.
- `decline` confirmado gera log de `decline` com `source = voice`.
- `marginal + Skip` não gera log.
- Dashboard atualiza **Last Voice Command** após cada ação real registrada.

---

## 17. Optional: Manual VPN Toggle

Esta etapa é opcional e separada do fluxo de decisão do BoostHub.

Use apenas se o usuário quiser criar um segundo atalho independente para alternar manualmente um perfil de rede no iPhone.

### Regra principal

O atalho de análise do BoostHub não deve ativar ou desativar VPN automaticamente com base em `accept`, `decline` ou `marginal`.

A alternância de VPN deve ser uma ação manual, iniciada pelo usuário, em um atalho separado.

---

### URLs padrão para atalho manual

#### Conectar perfil

```text
shadowrocket://connect
```

#### Desconectar perfil

```text
shadowrocket://disconnect
```

#### Alternar perfil

```text
shadowrocket://toggle
```

---

### Como criar o atalho manual

1. Abra o app **Atalhos**.
2. Toque em **+**.
3. Nomeie o atalho como:

```text
Toggle Network Profile
```

ou, em português:

```text
Alternar Perfil de Rede
```

4. Adicione a ação **Abrir URL**.
5. Cole uma das URLs:

```text
shadowrocket://connect
```

ou:

```text
shadowrocket://disconnect
```

ou:

```text
shadowrocket://toggle
```

6. Salve o atalho.
7. Execute manualmente quando quiser alternar o perfil.

---

### O que não fazer

Não coloque esta ação dentro do branch automático de `decision = decline`.

Não conecte/desconecte VPN sem confirmação explícita do usuário.

Não use a alternância de rede como substituto do registro real de decisão.

---

### Como manter logs corretos

1. Use `analyze-order` apenas para receber recomendação.
2. Confirme manualmente a ação real: `Accept`, `Decline` ou `Skip`.
3. Registre a ação real via `telegram-voice-command` somente após confirmação.
4. Execute o atalho de VPN separado apenas se o usuário decidir fazer isso manualmente.
