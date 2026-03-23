# Tuya Web Control (Smart Life depuis PC)

Application web Python pour lister et controler les equipements d'un compte Tuya/Smart Life.

## Ce que fait l'app

- Liste tous les equipements du compte (via API Cloud Tuya)
- Affiche l'etat (`status`) de chaque equipement
- Permet d'envoyer des commandes:
  - boutons rapides `switch_1` ON/OFF
  - formulaire libre `code + value(JSON)` pour tous les autres cas

## Prerequis

- Python 3.10+
- Un projet sur Tuya IoT Platform avec:
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

Edite `.env`:

```env
TUYA_API_REGION=eu
TUYA_API_KEY=your_client_id
TUYA_API_SECRET=your_secret
TUYA_API_DEVICE_ID=
APP_HOST=127.0.0.1
APP_PORT=8000
```

`TUYA_API_DEVICE_ID` est optionnel, mais utile pour certains comptes/projets.

## Lancer l'application

```bash
source .venv/bin/activate
python -m app.main
```

Puis ouvrir:

- http://127.0.0.1:8000

## Docker

Build de l'image:

```bash
docker build -t tuya-web-control .
```

Lancer le conteneur avec ton `.env` local:

```bash
docker run --rm -p 8000:8000 --env-file .env tuya-web-control
```

Puis ouvrir:

- http://127.0.0.1:8000

Optionnel: si tu veux changer le port expose cote host:

```bash
docker run --rm -p 8080:8000 --env-file .env tuya-web-control
```

## Login/password Smart Life: possible?

Partiellement et de maniere non fiable. Les endpoints de login direct sont non officiels et peuvent casser.

Un script de tentative est fourni:

```bash
source .venv/bin/activate
python scripts/login_password_bootstrap.py --region eu --username "email@exemple.com" --password "motdepasse"
```

Si ca ne marche pas, utilise la methode recommandee: `Client ID` + `Client Secret`.

## Securite

- `.env` est ignore par git (non tracke)
- Ne commit jamais tes secrets
