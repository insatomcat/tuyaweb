"""
Script optionnel (best effort) pour tenter une authentification via login/password.

Important:
- Cette methode depend de bibliotheques tierces et peut cesser de fonctionner.
- En pratique, la methode la plus stable reste l'utilisation d'un projet Tuya IoT
  avec TUYA_API_KEY/TUYA_API_SECRET.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import httpx


def try_cloud_token(region: str, username: str, password: str) -> dict[str, Any]:
    """
    Tentative simple d'authentification via endpoint app Tuya non officiel.
    Cela peut echouer selon la region/compte/politiques Tuya.
    """
    host_map = {
        "eu": "openapi-weaz.tuyaeu.com",
        "us": "openapi.tuyaus.com",
        "cn": "openapi.tuyacn.com",
        "in": "openapi-ueaz.in.tuya.com",
    }
    host = host_map.get(region.lower())
    if not host:
        raise ValueError("Region invalide (eu/us/cn/in)")

    url = f"https://{host}/v1.0/iot-03/users/login"
    payload = {"username": username, "password": password}

    with httpx.Client(timeout=20.0) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="Tentative login/password Tuya (best effort)")
    parser.add_argument("--region", required=True, choices=["eu", "us", "cn", "in"])
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    try:
        data = try_cloud_token(args.region, args.username, args.password)
    except Exception as exc:
        print(f"Echec: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2, ensure_ascii=True))
    print(
        "\nNote: si cette methode ne fonctionne pas, utilise l'approche "
        "TUYA_API_KEY/TUYA_API_SECRET via Tuya IoT Platform."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
