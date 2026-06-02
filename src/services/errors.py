"""Shared service/domain exceptions."""


class ArduinoNotRegistered(Exception):
    """Raised when an ESP32 node has not registered with the backend."""


class ArduinoUnreachable(Exception):
    """Raised when a registered ESP32 node is not responding."""
