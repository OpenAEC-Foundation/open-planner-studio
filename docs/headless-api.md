# Headless API (HTTP), container en AWS

De headless API is een kleine HTTP-server boven de headless kern (`@openaec/open-planner-core`,
zie [headless-kern.md](headless-kern.md)). De server ontvangt een IFC-planning, rekent die door zoals
de app en geeft een JSON-samenvatting of de herberekende IFC terug. De server bewaart niets.

Dit document hoort bij issue #429 (ecosystem readiness) en het gedeelde contract in
OpenAEC-style-book#12.

**Stand: er is nog geen deployment in AWS gedaan.** Er is geen AWS-account beschikbaar. De
CloudFormation-template is alleen met `cfn-lint` gecontroleerd. De container is in CI gebouwd en
getest, niet in ECS. Volgens het gedeelde contract heet de tool pas "Gereed voor AWS" na een
geslaagde smoke-test tegen een echte deployment (stap 7 hieronder).

## Bestanden

| bestand | wat |
|---|---|
| `headless/server/server.mjs` | de server op `node:http` |
| `headless/server/worker.mjs` | de rekenworker (één thread) |
| `headless/server/openapi.yaml` | het contract (OpenAPI 3.1) |
| `headless/server/smoke.mjs` | de smoke-test: `node smoke.mjs <baseUrl> <token>` |
| `headless/server/server-test.mjs`, `fixtures/log-marker.ifc` | de servertest: randgevallen (onleesbaar verzoek, capaciteit, logs, uploadtijd, SIGTERM) |
| `headless/server/Dockerfile`, `.dockerignore` (root) | de container |
| `deploy/aws/ecs-fargate.yaml` | de AWS-definitie (CloudFormation) |
| `.github/workflows/headless-api.yml` | CI: server lokaal, container, `cfn-lint` |

## Contract

Het volledige contract staat in `headless/server/openapi.yaml`.

| route | auth | wat |
|---|---|---|
| `GET /healthz` | nee | `200 {"status":"ok","version":"2026.9.0","limits":{…},"busy":false,"uploads":0}` |
| `POST /v1/schedule` | ja | IFC-tekst in de body. Uit: de JSON-samenvatting (`?output=summary`, standaard) of de herberekende IFC (`?output=ifc`, `Content-Type: application/x-step`). |

- Body-types: `application/x-step`, `application/ifc`, `model/ifc`, `text/plain` of
  `application/octet-stream`. Een ander type geeft 415.
- De samenvatting heeft dezelfde vorm als `ScheduleSummary` van de kern (`formatVersion: 1`).
- Elk antwoord heeft een header `X-Request-Id`. Stuur zelf een `X-Request-Id`
  (1–64 tekens `A-Z a-z 0-9 . _ -`) om een verzoek in de logs terug te vinden.

### Fouten

Een fout heeft altijd deze vorm. `code` is vast; `message` is Engels en voor mensen.

```json
{ "error": { "code": "SCHEDULE_FAILED", "message": "…", "details": { "taskIds": ["…"] } } }
```

| status | code | wanneer |
|---|---|---|
| 400 | `INVALID_INPUT` | de body is geen ISO-10303-21-tekst |
| 400 | `BAD_REQUEST` | `output` is niet `summary` of `ifc`, of het request-target is geen geldige URL |
| 401 | `UNAUTHORIZED` | token ontbreekt of is fout (met `WWW-Authenticate: Bearer`) |
| 404 | `NOT_FOUND` | onbekend pad |
| 405 | `METHOD_NOT_ALLOWED` | verkeerde methode (met `Allow`) |
| 408 | `UPLOAD_TIMEOUT` | de body kwam niet binnen de uploadtijd binnen |
| 413 | `PAYLOAD_TOO_LARGE` | body groter dan de grens |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | verkeerd `Content-Type` |
| 422 | `IFC_READ_FAILED`, `NO_TASKS`, `SCHEDULE_FAILED` | IFC, maar niet te plannen (bijv. een kring) |
| 500 | `IFC_WRITE_FAILED`, `INTERNAL` | fout in de server |
| 503 | `BUSY`, `TIMEOUT` | er loopt al een berekening of er komen al te veel bodies binnen (beslist vóór de body), of de berekening duurde te lang (met `Retry-After`) |

De volgorde van de controles is: pad (404), methode (405), token (401), `output` (400), type (415),
gemelde grootte (413), capaciteit (503 `BUSY`), daarna de body en de berekening. Zonder geldig token
of zonder capaciteit leest de server de body dus niet; hij gooit hem ongelezen weg.

Een onleesbaar verzoek (bijv. `GET //[`) geeft 400. Geen enkele fout in de afhandeling van een
verzoek stopt het proces: de afhandeling vangt elke fout af (500 `INTERNAL`), en een fout daarbuiten
wordt alleen gelogd.

## Auth

- De client stuurt `Authorization: Bearer <token>`.
- De server vergelijkt het token in constante tijd: beide kanten worden aangevuld tot 512 bytes,
  daarna `crypto.timingSafeEqual`. Zo lekt ook de lengte niet.
- Het token komt uit `OPS_API_TOKEN` of uit het bestand in `OPS_API_TOKEN_FILE` (niet allebei). Het
  token moet minstens 16 tekens en hooguit 512 bytes hebben.
- Zonder token start de server niet (exitcode 78). Er is geen "open" modus.
- Het token staat nooit in de image, de broncode of de logs.
- Er is één token met volledige toegang; rollen of meerdere gebruikers zijn er niet. De API bewaart
  en deelt geen data, dus een token geeft alleen rekenkracht.

## Grenzen en gedrag

| variabele | standaard | wat |
|---|---|---|
| `OPS_API_TOKEN` / `OPS_API_TOKEN_FILE` | — (verplicht) | het bearer-token |
| `HOST` | `127.0.0.1` (container: `0.0.0.0`) | adres om op te luisteren |
| `PORT` | `8080` | poort |
| `OPS_API_MAX_BODY_BYTES` | `20971520` (20 MiB) | maximale body; meer geeft 413 |
| `OPS_API_TIMEOUT_MS` | `60000` (max `85000`) | maximale rekentijd per verzoek; meer geeft 503 `TIMEOUT` |
| `OPS_API_UPLOAD_TIMEOUT_MS` | `30000` (max `30000`) | maximale tijd om de body te ontvangen; meer geeft 408 `UPLOAD_TIMEOUT` |
| `OPS_API_MAX_UPLOADS` | `2` | bodies die tegelijk binnenkomen; meer geeft meteen 503 `BUSY` |

- **Geen wachtrij.** Eén berekening tegelijk, in een worker-thread. Loopt er een berekening, of komen
  er al `OPS_API_MAX_UPLOADS` bodies binnen, dan krijgt een nieuw verzoek meteen 503 `BUSY` met
  `Retry-After: 5`, vóórdat de server de body leest. Het geheugen voor bodies is dus begrensd op
  `OPS_API_MAX_UPLOADS × OPS_API_MAX_BODY_BYTES` (standaard 40 MiB). Wil je meer tegelijk rekenen,
  draai dan meer taken (`DesiredCount`).
- **Tijdbudget.** Een geaccepteerd verzoek duurt hooguit uploadtijd + rekentijd: standaard 30 + 60 =
  90 s, en hooguit 30 + 85 = 115 s. Dat ligt onder de idle-timeout van de load balancer (120 s). Zo
  antwoordt de server altijd zelf, met JSON, en nooit de ALB met een 504. De template legt dezelfde
  grenzen vast (`UploadTimeoutMs`, `CalculationTimeoutMs`).
- Bij een timeout stopt de server de worker en start bij het volgende verzoek een nieuwe.
  `/healthz` blijft intussen antwoorden en meldt `busy` en `uploads`.
- Een te grote body (volgens `Content-Length`, of tijdens het lezen) krijgt meteen 413. Na vier keer
  de grens of de uploadtijd verbreekt de server de verbinding.
- `node:http`-grenzen: `headersTimeout` (10 s) ≤ `requestTimeout` (uploadtijd + 5 s, een vangnet),
  gecontroleerd elke seconde. `keepAliveTimeout` is 125 s, iets langer dan de ALB-idle-timeout.
- Op `SIGTERM` neemt de server geen nieuwe verbindingen meer aan. Lopende verzoeken (upload en
  berekening) krijgen nog antwoord; daarna sluit hij de verbindingen en stopt hij, binnen 25 s.
- Opslag: geen. Elk verzoek staat los; er blijft niets op schijf of in het geheugen.

## Logging

Eén JSON-regel per verzoek naar stdout, bijvoorbeeld:

```json
{"time":"2026-10-21T07:08:38.933Z","level":"info","msg":"request","requestId":"…","method":"POST","path":"/v1/schedule","status":200,"durationMs":27.9,"bytesIn":48925}
```

Bij een fout staat er ook `errorCode`; bij een afgebroken verbinding `aborted: true`. De server logt
nooit IFC-inhoud, de querystring of het token. De rekenkern schrijft soms id's of namen uit het
bestand naar de console (bijv. een relatie-id die hij negeert). Die uitvoer blijft in de worker: de
worker zet zijn console stil, en de server gooit de stdout en stderr van de worker weg.
In AWS komen de regels in CloudWatch Logs.

## Lokaal draaien

```bash
npm ci
npm run build:core
(cd headless/server && npm install)          # installeert dist-core als pakket
export OPS_API_TOKEN="$(openssl rand -hex 24)"
node headless/server/server.mjs              # luistert op 127.0.0.1:8080
node headless/server/smoke.mjs http://127.0.0.1:8080 "$OPS_API_TOKEN"

curl -s -H "Authorization: Bearer $OPS_API_TOKEN" -H 'Content-Type: application/x-step' \
  --data-binary @examples/01-grachtenpand-amsterdam.ifc http://127.0.0.1:8080/v1/schedule
```

## Container

```bash
docker build -f headless/server/Dockerfile -t open-planner-api .
docker run --rm -p 127.0.0.1:8080:8080 -e OPS_API_TOKEN --read-only --cap-drop ALL open-planner-api
node headless/server/smoke.mjs http://127.0.0.1:8080 "$OPS_API_TOKEN"
```

- Twee stappen: de eerste bouwt de kern uit de broncode (`npm ci` op de lockfile en
  `scripts/build-core.mjs`); de tweede bevat alleen Node 22, het gebouwde pakket en `server.mjs` en
  `worker.mjs`.
- Linux (`node:22-bookworm-slim`, vastgepind op een digest in `ARG NODE_IMAGE`), gebruiker `node`
  (niet root), poort 8080, `HEALTHCHECK` op `/healthz`. Bijwerken: zoek de nieuwe digest van de tag
  `node:22-bookworm-slim` op (`docker buildx imagetools inspect node:22-bookworm-slim`) en zet die in
  de Dockerfile.
- De server schrijft niets naar schijf, dus een alleen-lezen bestandssysteem werkt.

## AWS: ECS Fargate achter een ALB

Gekozen runtime: **een Linux-container op ECS Fargate achter een Application Load Balancer**. Reden:
de berekening kan bij grote projecten langer duren dan een paar seconden en gebruikt veel geheugen.
Een langlopende container met een eigen deadline past daar beter bij dan een Lambda-functie. Ook
verandert de server niet tussen lokaal, container en AWS.

De template `deploy/aws/ecs-fargate.yaml` maakt:

- een ECS-cluster, een taakdefinitie (Fargate, `awsvpc`, cpu/geheugen als parameter, alleen-lezen
  root-bestandssysteem, gebruiker `node`, health check) en een service met circuit breaker en rollback;
- een ALB met een HTTPS-listener (ACM-certificaat als parameter, TLS 1.2/1.3-beleid), een redirect van
  HTTP naar HTTPS, en een target group met health check op `/healthz`;
- security groups: de ALB alleen op 443/80 vanuit `AllowedCidr`, de taken alleen op 8080 vanuit de ALB;
- een execution role met alleen: image halen uit de ene ECR-repository, schrijven naar de ene
  loggroep, het ene secret lezen (en optioneel `kms:Decrypt` via Secrets Manager). Er is geen task
  role: de API roept zelf geen AWS-diensten aan;
- een CloudWatch-loggroep met retentie (standaard 30 dagen).

Het token komt uit Secrets Manager en staat als `OPS_API_TOKEN` in de taak. De image en de broncode
bevatten geen configuratie of secrets.

### Deployen, stap voor stap

Nodig: een AWS-account, de AWS CLI, Docker, een VPC met minstens twee subnets in verschillende
zones, en een ACM-certificaat voor de domeinnaam van de API.

1. **ECR-repository maken.**
   ```bash
   aws ecr create-repository --repository-name open-planner-api --image-scanning-configuration scanOnPush=true
   ```
2. **Image bouwen en pushen** (linux/amd64, of arm64 met `CpuArchitecture=ARM64`).
   ```bash
   ACCOUNT=123456789012; REGION=eu-west-1; REPO=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/open-planner-api
   aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
   docker build --platform linux/amd64 -f headless/server/Dockerfile -t $REPO:2026.9.0 .
   docker push $REPO:2026.9.0
   DIGEST=$(aws ecr describe-images --repository-name open-planner-api --image-ids imageTag=2026.9.0 --query 'imageDetails[0].imageDigest' --output text)
   ```
3. **Token in Secrets Manager zetten.**
   ```bash
   aws secretsmanager create-secret --name open-planner-api/token --secret-string "$(openssl rand -hex 32)"
   ```
4. **Stack maken.**
   ```bash
   aws cloudformation deploy --stack-name open-planner-api \
     --template-file deploy/aws/ecs-fargate.yaml --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       ImageUri=$REPO@$DIGEST \
       EcrRepositoryArn=arn:aws:ecr:$REGION:$ACCOUNT:repository/open-planner-api \
       ApiTokenSecretArn=<ARN van het secret uit stap 3> \
       CertificateArn=<ARN van het ACM-certificaat> \
       VpcId=vpc-… LoadBalancerSubnetIds=subnet-a,subnet-b TaskSubnetIds=subnet-c,subnet-d
   ```
   Private task-subnets hebben een NAT-gateway of VPC-endpoints nodig (ECR, S3, CloudWatch Logs,
   Secrets Manager). Zonder NAT: publieke subnets en `AssignPublicIp=ENABLED`.
5. **DNS.** Zet een CNAME- of alias-record van de domeinnaam van het certificaat naar de output
   `LoadBalancerDnsName`.
6. **Wachten tot de service stabiel is.**
   ```bash
   aws ecs wait services-stable --cluster <output ClusterName> --services <output ServiceName>
   ```
7. **Smoke-test na deploy.**
   ```bash
   TOKEN=$(aws secretsmanager get-secret-value --secret-id open-planner-api/token --query SecretString --output text)
   node headless/server/smoke.mjs https://planner-api.example.org "$TOKEN"
   ```
   De test stuurt ook een body van één byte boven de grens (standaard ruim 20 MB) om 413 te
   controleren. Draai hem zonder ander verkeer: tijdens een berekening geeft de API meteen 503. Groen betekent: health, auth, routes, foutvorm, een voorbeeld doorrekenen met de
   verwachte uitkomst en de grens werken via de ALB.
8. **Logs bekijken.**
   ```bash
   aws logs tail /ecs/open-planner-api --follow
   ```

Een nieuwe versie: stap 2 met een nieuwe tag, dan stap 4 met de nieuwe `ImageUri`. De circuit
breaker zet een mislukte deploy terug.

## CI

`.github/workflows/headless-api.yml` draait op elke push naar `main` en op een PR die `src/`, de
kernbouw, `headless/`, `deploy/aws/`, de lockfile of de workflow raakt:

- **local**: `npm run build:core`, server starten, weigeren zonder token (exit 78), smoke-test,
  servertest (`server-test.mjs`: `GET //[` → 400 zonder crash, 30 uploads boven de grens → meteen 503
  en RSS begrensd, tweede verzoek tijdens een berekening → meteen 503, merkteken uit het IFC niet in
  de logs, 408 bij een te trage body, SIGTERM tijdens een upload), logs zonder token of IFC-inhoud,
  `redocly lint` op het OpenAPI-contract;
- **container**: image bouwen, niet-root controleren, weigeren zonder token, container alleen-lezen
  en zonder capabilities starten, wachten op `healthy`, smoke-test, logs controleren, netjes stoppen
  op `SIGTERM`;
- **cfn-lint**: `cfn-lint deploy/aws/ecs-fargate.yaml`.

## Wat er nog niet is

- Een deployment in AWS (geen account). Daarom ook geen bewijs uit de bedoelde runtime.
- Een Lambda-variant. Die is bewust niet gekozen (zie boven).
- Publicatie van de image naar een register. De CI bouwt en test de image, maar pusht hem niet.
- Meer invoerformaten dan IFC, en bewerkingen op de planning. Zie [headless-kern.md](headless-kern.md).
