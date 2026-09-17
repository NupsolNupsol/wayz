# The learning/AI service.
#
# Python 3.11 rather than "latest": torch and sentence-transformers publish wheels a couple
# of minor versions behind the newest interpreter, and building them from source is not a
# thing anybody should do by accident.
#
# Three targets:
#   testing  — the light dependency set, for `pytest`. No torch, ~200 MB, seconds to build.
#   runtime  — the real service.
#   (base)   — shared system layer.

# ---------------------------------------------------------------------------- base
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/srv

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------- testing
FROM base AS testing

COPY requirements-test.txt ./
RUN pip install -r requirements-test.txt

COPY app ./app
COPY tests ./tests
COPY pyproject.toml ./

CMD ["pytest", "-q"]

# ---------------------------------------------------------------------------- runtime
FROM base AS runtime

# espeak-ng is the text-to-speech fallback, and curl/tar fetch the Piper voice below. Both
# are in the runtime image on purpose: a deployment with no network at build time still gets
# a working listen button, just a more robotic one.
RUN apt-get update && apt-get install -y --no-install-recommends \
      espeak-ng \
      curl \
      tar \
    && rm -rf /var/lib/apt/lists/*

# Torch first, from the CPU index. The default index serves the CUDA build: ~2.5 GB of
# kernels for hardware this container does not have and would not use.
#
# 2.6 is a floor, not a preference: transformers refuses to call torch.load on anything older
# (CVE-2025-32434), and BGE-M3 ships weights that take that path. 2.5 installs fine and then
# fails at the first embedding, which is the worst place to find out.
RUN pip install --index-url https://download.pytorch.org/whl/cpu "torch==2.6.0"

COPY requirements.txt ./
RUN pip install -r requirements.txt

# ----- Piper: the binary and one Arabic voice, baked in --------------------------------
# Downloaded at BUILD time so a container restart never re-fetches them. Both steps are
# allowed to fail: a build behind a proxy that cannot reach GitHub still produces a working
# image, and PiperTTSProvider.available() then reports false and the espeak fallback answers.
ARG PIPER_VERSION=2023.11.14-2
ARG PIPER_VOICE=ar_JO-kareem-low
ENV PIPER_MODEL_PATH=/models/piper/${PIPER_VOICE}.onnx

RUN set -eux; \
    mkdir -p /models/piper /opt; \
    ( curl -fsSL -o /tmp/piper.tar.gz \
        "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
      && tar -xzf /tmp/piper.tar.gz -C /opt \
      && ln -sf /opt/piper/piper /usr/local/bin/piper \
      && rm -f /tmp/piper.tar.gz ) || echo "piper binary unavailable at build time"; \
    ( curl -fsSL -o "/models/piper/${PIPER_VOICE}.onnx" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/low/${PIPER_VOICE}.onnx?download=true" \
      && curl -fsSL -o "/models/piper/${PIPER_VOICE}.onnx.json" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/ar/ar_JO/kareem/low/${PIPER_VOICE}.onnx.json?download=true" ) \
      || echo "piper voice unavailable at build time"

# The embedding model is NOT baked in: BGE-M3 is ~2.3 GB and belongs in a cache volume that
# survives rebuilds, not in a layer that is rebuilt with every code change. It downloads on
# first use into HF_HOME, which compose mounts as a named volume.
ENV HF_HOME=/models/hf \
    SENTENCE_TRANSFORMERS_HOME=/models/hf \
    TTS_CACHE_DIR=/var/cache/lockerflow-tts

RUN mkdir -p /models/hf /var/cache/lockerflow-tts

COPY app ./app

# The starter documents `python -m app.seed_knowledge` loads into a fresh stack.
COPY knowledge-samples ./knowledge-samples

# Not root. This process reads uploaded text and calls out to a subprocess; there is no
# reason for it to be able to write anywhere outside the paths it was given.
RUN useradd --create-home --uid 10001 lockerflow \
    && chown -R lockerflow:lockerflow /models /var/cache/lockerflow-tts /srv
USER lockerflow

EXPOSE 8088

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8088/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088", "--proxy-headers"]
