from sqlmodel import create_engine, SQLModel, Session
from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Primary SQLModel engine (fallback to sqlite if Postgres URL not set)
engine = create_engine(settings.SQLALCHEMY_DATABASE_URI, echo=False)

# Optional Supabase client for specialized Storage/Auth functions
supabase: Client | None = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")

def init_db():
    from app.models import patient, vital_sign, risk_assessment, sensor_session
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

