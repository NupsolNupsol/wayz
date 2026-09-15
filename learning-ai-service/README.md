# LockerFlow Learning & AI Service

Arabic-first retrieval-augmented assistance for LockerFlow employees: tenant-aware knowledge
retrieval, grounded answers, and local text-to-speech.

A separate process in a separate language on purpose. RAG drags in torch, a 2.3 GB embedding
model and a speech binary; none of that belongs in the booking API, and putting it there would
mean every deployment of the POS also deploys a machine-learning stack.

---

## 1 · How the pieces talk

```
  browser (React)
      │  session cookie-less bearer token, tenant workspace
      ▼
  LockerFlow Node API            ← the only client this service has
      │  short-lived HS256 token, signed with AI_SERVICE_SECRET,
      │  carrying { tenantId, role, userId } read from the verified session
      ▼
  this service (FastAPI)
      ├── BAAI/bge-m3 (local, CPU)       embeddings — no API cost, Arabic-capable
      ├── Qdrant                          one collection, filtered by payload
      ├── MongoDB (lockerflow_ai)         the document catalogue and learning events
      ├── OpenAI                          final answer generation only
      └── Piper (ar_JO-kareem) / espeak   local speech — no API cost
```

**The browser never reaches this service.** There is no CORS configuration, no published port
in the Compose stack, and no endpoint that accepts a tenant id.

---

## 2 · Why the tenant filter is the security boundary

LockerFlow separates operational data by *database* — one Mongo database per tenant. This
service does not, and that is a deliberate, different decision for a different kind of data.

**One Qdrant collection, filtered by payload.** The reasoning:

* Every employee question has to search their company's procedures *and* LockerFlow's own
  documentation, ranked together. Collection-per-tenant makes that two searches and a
  hand-rolled merge.
* A Qdrant collection carries its own segments and HNSW graph. A few hundred tenants of a
  dozen documents each would be a few hundred mostly-empty indexes — the shape that falls
  over first.
* This is explanatory text, not operational records. A leak here is serious; it is not the
  same risk as a booking table.

Because isolation now rests on a filter rather than on a connection, the filter is treated as
security code, with three independent guarantees:

1. **It is built in one place.** `vector_store.access_filter()` reads the tenant and role off
   an `Actor` that came out of a verified signature. No function anywhere builds a filter from
   a request body — there is no parameter for it.
2. **Every hit is checked again.** `vector_store.enforce_scope()` drops any result whose
   payload does not match the caller and logs it as an error. A bug in filter construction is
   a dropped row, not a breach.
3. **The tests attack this layer directly**, not the API above it — see
   `tests/test_tenant_isolation.py`.

Global documents carry the sentinel tenant `__GLOBAL__` so a single payload index serves both
scopes, and a document with no role restriction carries `role_keys: ["*"]` so "everyone" and
"nobody" cannot be confused by a missing field.

---

## 3 · Server-to-server authentication

The Node API mints a 120-second HS256 JWT per call:

```jsonc
{
  "iss": "lockerflow-api",
  "aud": "lockerflow-ai",
  "sub": "<user id or platform admin id>",
  "iat": …, "exp": …, "jti": "…",
  "ctx": {
    "kind": "EMPLOYEE" | "PLATFORM_ADMIN",
    "tenantId": "…", "tenantSlug": "…", "tenantName": "…",
    "role": "AGENT", "locale": "ar"
  }
}
```

Signed with **`AI_SERVICE_SECRET`, which is deliberately not `JWT_SECRET`** — they protect
different things, and a leaked tenant session must not become the ability to mint
"I am a platform administrator" here.

This service refuses the token unless signature, issuer, audience and expiry all check out,
and then:

* an `EMPLOYEE` token **must** carry both a tenant and a known role, or it is rejected —
  there is no such thing as a global employee;
* a `PLATFORM_ADMIN` token has its tenant and role **discarded** even if present, so a
  smuggled `tenantId` grants nothing;
* an unknown role value is rejected rather than treated as unprivileged.

Unset the secret and the service refuses every request and says so loudly at startup.
Refusing everybody beats trusting everybody.

---

## 4 · Endpoints

| Method | Path | Who | What |
|---|---|---|---|
| `GET` | `/health` | anyone | Liveness. Touches no dependency — a wobbly Qdrant is not a reason to restart. |
| `GET` | `/health/ready` | anyone | Per-dependency readiness. Never prints a secret. |
| `POST` | `/v1/documents` | platform admin | Create + index (JSON, content inline) |
| `POST` | `/v1/documents/upload` | platform admin | Create + index (multipart `.txt`) |
| `GET` | `/v1/documents` | platform admin | List, filtered by scope/tenant |
| `GET` | `/v1/documents/{id}` | platform admin | Full record incl. original text |
| `PATCH` | `/v1/documents/{id}` | platform admin | Replace title/content, bump version, re-index |
| `POST` | `/v1/documents/{id}/reindex` | platform admin | Re-embed in place |
| `DELETE` | `/v1/documents/{id}` | platform admin | Remove vectors, then the record |
| `GET` | `/v1/analytics` | platform admin | Learning dashboard figures |
| `POST` | `/v1/chat` | employee | Ask. Returns answer + sources + videos + `grounded` |
| `POST` | `/v1/speech` | employee | Arabic WAV of a given text |
| `POST` | `/v1/feedback` | employee | 👍 / 👎 on one answer |
| `POST` | `/v1/events/video-click` | employee | Records a training video being opened |
| `GET` | `/v1/whoami` | either | What this service believes about the caller |

Indexing is **synchronous**. A background task would return "accepted" and leave the
administrator watching a spinner that never resolves when the embedder is down; these
documents are a few kilobytes, and the honest answer is the one that waits.

---

## 5 · Prompt-injection posture

Retrieved passages are **data, never instructions**:

* the system prompt is loaded from `app/prompts/system_ar.md` and is the only content in the
  `system` role — nothing from a document ever reaches it;
* documents are wrapped in a labelled `<<<REFERENCES_BEGIN>>> … <<<REFERENCES_END>>>` block
  inside the *user* turn, introduced as untrusted reference material;
* the prompt explicitly states that instructions found inside references have no authority;
* and none of it matters to isolation anyway: the tenant filter was applied before any of
  that text existed, so a document telling the model to reveal another tenant's files is
  asking it to reveal something it was never given.

`tests/test_chat.py::test_retrieved_text_is_fenced_as_untrusted_reference_material` asserts
the fence.

**YouTube links are never fetched by the server.** They are extracted, validated against an
allow-list of YouTube hosts, normalised to a canonical watch URL and stored as metadata. The
browser is the only thing that ever contacts YouTube — there is no SSRF surface here, and the
video-click analytics endpoint re-validates the URL rather than storing whatever it is sent.

---

## 6 · Running it

The service is part of the main Compose stack in `backend/docker-compose.yml`:

```bash
# from the repository root
cp backend/.env.example backend/.env      # then fill in JWT_SECRET, AI_SERVICE_SECRET, OPENAI_API_KEY
cd backend
docker compose up -d --build
```

Readiness (the model loads in the background at startup, ~30 s the first time after the
download):

```bash
docker compose exec learning-ai \
  python -c "import urllib.request,json;print(json.load(urllib.request.urlopen('http://127.0.0.1:8088/health/ready'))['status'])"
```

### Tests

The suite runs against a light image with no torch — seconds, not minutes:

```bash
cd learning-ai-service
docker build --target testing -t lockerflow-ai-test .
docker run --rm lockerflow-ai-test pytest -q
docker run --rm lockerflow-ai-test ruff check .
```

It substitutes a deterministic hashing embedder, an in-memory Qdrant, an in-memory catalogue
and an echo LLM (see `tests/conftest.py`). Retrieval, filtering, ingestion, chunking,
authorisation and scoping are all exercised for real — and no test makes a paid API call.

---

## 7 · Models: what is downloaded and where it lives

| Thing | Size | When | Where |
|---|---|---|---|
| Piper binary + `ar_JO-kareem-low` voice | ~85 MB | **Build time**, baked into the image | `/opt/piper`, `/models/piper` |
| `BAAI/bge-m3` | ~2.3 GB | **First use**, once | `/models/hf` → Docker volume `ai_models` |
| `espeak-ng` | ~5 MB | Build time (apt) | system |

The embedding model is in a volume and not a layer on purpose: it survives every rebuild, and
baking it in would re-download 2.3 GB on every code change. The Piper download is allowed to
fail at build time — a build behind a restrictive proxy still produces a working image, and
the provider falls back to `espeak-ng`.

Approximate requirements: ~4 GB of disk for the image plus ~2.5 GB for the model volume, and
roughly 2 GB of RAM resident once BGE-M3 is loaded. If that is too much,
`EMBEDDING_MODEL=intfloat/multilingual-e5-small` with `EMBEDDING_DIM=384` is ~470 MB — drop
the Qdrant collection and re-index after changing it, because the vector width changes.

---

## 8 · Layout

```
app/
  config.py          every setting, one place
  security.py        the Actor, and how a token becomes one
  domain.py          roles and scopes, mirrored from the Node API
  errors.py          what this service is willing to say out loud
  logging_config.py  structured JSON + a redaction list
  prompts/           the Arabic system prompt, as a file
  routers/           health, documents (admin), chat (employee)
  schemas/           typed request/response shapes
  services/
    chunking.py      Arabic-aware, and reluctant to split
    embeddings.py    BGE-M3, loaded once
    vector_store.py  Qdrant + the access filter + the second fence
    registry.py      the document catalogue and learning events
    retrieval.py     filter → rank → budget
    chat.py          the RAG pipeline
    youtube.py       extraction, validation, never fetching
    llm/             provider seam (OpenAI, echo)
    tts/             provider seam (Piper, espeak, null)
tests/               the suite, including the isolation attack
knowledge-samples/   three Arabic .txt files to try it with
```
