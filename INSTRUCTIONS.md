# SHU Hackathon 2026 — Setup Guide

Get the project running on your machine in ~10 minutes

---

## Prerequisites

### 1. Install Node.js
If you don't have Node.js installed:
- Go to **https://nodejs.org**
- Download and install the **LTS version**
- Verify it works by opening your terminal and running:
```bash
node -v
npm -v
```
Both should print a version number (e.g. `v20.x.x`)

### 2. Install Python

**Windows:**
- Go to **https://www.python.org** and download the latest **3.x** version
- **Add Python to PATH**, very important
- Verify:
```bash
python --version
pip --version
```

**Ubuntu/Linux:**
Python is usually pre-installed, verify with:
```bash
python3 --version
```
If not installed:
```bash
sudo apt update
sudo apt install python3 python3-pip python3-full
```

---

## Project Setup

### 3. Clone the repo
```bash
git clone https://github.com/poncema4/SHU-Hackathon-2026.git
cd SHU-Hackathon-2026/hackathon-template
```

### 4. Install frontend dependencies
```bash
npm install
npm install axios
npm install -D tailwindcss postcss autoprefixer @tailwindcss/vite
```

### 5. Install backend dependencies

**Windows:**
```bash
pip install flask flask-cors
```

**Ubuntu/Linux:** You need a virtual environment first:
```bash
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors
```

You should see `(venv)` at the start of your terminal line, that means it worked

> Every time you open a new terminal to run Flask, you must activate the virtual environment first:
> ```bash
> source venv/bin/activate
> ```

---

## Running the App

You need **two terminals open at the same time**, one for the frontend, one for the backend

### Terminal 1: Start the Flask backend

**Windows:**
```bash
python app.py
```

**Ubuntu/Linux:**
```bash
source venv/bin/activate
python3 app.py
```

Backend runs on **http://localhost:5000**

### Terminal 2: Start the React frontend
```bash
npm run dev
```

Frontend runs on **http://localhost:5173**

Open **http://localhost:5173** in your browser and you should see the app running

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React + Vite | Frontend framework |
| Flask | Backend framework |
| Tailwind CSS v4 | Styling |
| Axios | HTTP requests |
| Anthropic Claude | AI backbone |

---