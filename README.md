# Tuya Web Control (Smart Life from PC)

Python web app to list and control devices from a Tuya/Smart Life account.

## What the app does

- Lists all account devices (via Tuya Cloud API)
- Shows each device state (`status`)
- Lets you send commands:
  - quick `switch_1` ON/OFF buttons
  - free-form `code + value (JSON)` form for all other use cases

## Prerequisites

- Python 3.10+
- A project on Tuya IoT Platform with:
  - `Client ID` (API Key)
  - `Client Secret`
  - region (`eu`, `us`, `cn`, `in`)

## Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```env
TUYA_API_REGION=eu
TUYA_API_KEY=your_client_id
TUYA_API_SECRET=your_secret
TUYA_API_DEVICE_ID=
APP_HOST=127.0.0.1
APP_PORT=8000
```

`TUYA_API_DEVICE_ID` is optional, but useful for some accounts/projects.

## Run the application

```bash
source .venv/bin/activate
python -m app.main
```

Then open:

- http://127.0.0.1:8000

## Docker

Build the image:

```bash
docker build -t tuyaweb .
```

Run the container with your local `.env`:

```bash
docker run --rm -p 8000:8000 --env-file .env tuyaweb
```

Then open:

- http://127.0.0.1:8000

Optional: if you want to change the host-exposed port:

```bash
docker run --rm -p 8080:8000 --env-file .env tuya-web-control
```

## Smart Life login/password: is it possible?

Partially and not reliably. Direct login endpoints are unofficial and may break.

A bootstrap attempt script is provided:

```bash
source .venv/bin/activate
python scripts/login_password_bootstrap.py --region eu --username "email@example.com" --password "password"
```

If this does not work, use the recommended method: `Client ID` + `Client Secret`.

## Security

- `.env` is ignored by git (not tracked)
- Never commit your secrets
