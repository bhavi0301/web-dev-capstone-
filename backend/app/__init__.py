# Init app package
import os
from dotenv import load_dotenv

# Load .env file from the parent directory of backend/app (i.e. backend/)
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path)
