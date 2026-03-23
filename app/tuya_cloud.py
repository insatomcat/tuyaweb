import os
from typing import Any, Dict, List

import tinytuya


class TuyaCloudError(RuntimeError):
    pass


class TuyaCloudClient:
    def __init__(self) -> None:
        self.region = os.getenv("TUYA_API_REGION", "").strip()
        self.api_key = os.getenv("TUYA_API_KEY", "").strip()
        self.api_secret = os.getenv("TUYA_API_SECRET", "").strip()
        self.device_id = os.getenv("TUYA_API_DEVICE_ID", "").strip()

        missing = [
            key
            for key, value in {
                "TUYA_API_REGION": self.region,
                "TUYA_API_KEY": self.api_key,
                "TUYA_API_SECRET": self.api_secret,
            }.items()
            if not value
        ]
        if missing:
            raise TuyaCloudError(
                f"Variables d'environnement manquantes: {', '.join(missing)}"
            )

        self._cloud = tinytuya.Cloud(
            apiRegion=self.region,
            apiKey=self.api_key,
            apiSecret=self.api_secret,
            apiDeviceID=self.device_id,
        )

    @staticmethod
    def _unwrap(response: Any) -> Any:
        if isinstance(response, dict) and response.get("success") is False:
            msg = response.get("msg", "Erreur API Tuya")
            code = response.get("code")
            if code:
                msg = f"{msg} (code: {code})"
            raise TuyaCloudError(msg)
        return response

    def list_devices(self) -> List[Dict[str, Any]]:
        response = self._cloud.getdevices()
        data = self._unwrap(response)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            result = data.get("result")
            if isinstance(result, list):
                return result
        raise TuyaCloudError("Réponse inattendue lors de la liste des équipements")

    def get_device_capabilities(self, device_id: str) -> Dict[str, Any]:
        functions = self._unwrap(self._cloud.getfunctions(device_id))
        properties = self._unwrap(self._cloud.getproperties(device_id))
        status = self._unwrap(self._cloud.getstatus(device_id))

        return {
            "functions": functions,
            "properties": properties,
            "status": status,
        }

    def send_commands(self, device_id: str, commands: List[Dict[str, Any]]) -> Dict[str, Any]:
        payload = {"commands": commands}
        response = self._cloud.sendcommand(device_id, payload)
        data = self._unwrap(response)
        if isinstance(data, dict):
            return data
        return {"success": True, "result": data}
