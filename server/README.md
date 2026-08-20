# FastAPI Server

This is a FastAPI project.

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository_url>
cd fastapi-server
```

### 2. Create a Virtual Environment

It is recommended to use a virtual environment to manage your dependencies.

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

### 3. Install Dependencies

Install the required packages using `requirements.txt`.

```bash
pip install -r requirements.txt
```

### 4. Environment Variables

This project uses environment variables for configuration. 
Create a `.env` file in the root directory by copying the example file (if available), or create a new `.env` file and add the necessary configuration.

Example `.env` file:
```env
# Add your environment variables here
# DATABASE_URL=postgresql://user:password@localhost/dbname
# SECRET_KEY=your_secret_key
```
**Note:** Make sure you never commit your `.env` file to version control. It should be added to `.gitignore`.

### 5. Run the Application

You can start the FastAPI server using Uvicorn.

```bash
uvicorn app.main:app --reload
```
The API will be available at `http://127.0.0.1:8000`. You can also view the interactive documentation at `http://127.0.0.1:8000/docs`.
