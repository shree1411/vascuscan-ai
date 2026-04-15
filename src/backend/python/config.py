"""
VASCUSCAN AI — Flask Backend Configuration
Provides app factory, config classes, and extension initialization.
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration shared across all environments."""

    # Flask
    SECRET_KEY: str = os.getenv("SECRET_KEY", "vascuscan-dev-secret-change-in-prod")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Database — PostgreSQL in production, SQLite fallback for dev
    SQLALCHEMY_DATABASE_URI: str = os.getenv(
        "DATABASE_URL", "sqlite:///vascuscan.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ENGINE_OPTIONS: dict = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }

    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "vascuscan-jwt-secret-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES: timedelta = timedelta(hours=24)

    # Rate limiting
    RATELIMIT_DEFAULT: str = "200 per day, 50 per hour"
    RATELIMIT_STORAGE_URL: str = "memory://"

    # Flask-SocketIO
    SOCKETIO_ASYNC_MODE: str = "threading"

    # CORS — allow all origins in dev; tighten in production
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # App
    PORT: int = int(os.getenv("PORT", "5000"))


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    # Ensure SQLALCHEMY_DATABASE_URI is set via DATABASE_URL in prod
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)


# Environment → config class mapping
config_map: dict = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config() -> Config:
    """Return the appropriate config class based on FLASK_ENV."""
    env = os.getenv("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
