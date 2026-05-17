# 🚀 Prep Wise AI Platform

![Prep Wise Banner](https://via.placeholder.com/1200x300/0f172a/38bdf8?text=Prep+Wise+AI+Platform)

**Prep Wise** is an advanced, AI-powered career preparation platform designed to help job seekers build professional resumes and ace their interviews. It combines real-time voice AI mock interviews, a dynamic LaTeX resume builder, and an aggressive AI-driven ATS resume analyzer into a single, cohesive, luxury dark-mode interface.

---

## ✨ Key Features

### 🎙️ Real-Time Voice AI Mock Interviews
*   **Vapi-Powered Voice Agent**: Engage in highly realistic, conversational mock interviews with an AI agent.
*   **Highly Tailored**: Customize the interview by job role, experience level, target company, and specific job descriptions.
*   **Live Visualizer**: Real-time waveform visualizers and call duration tracking for an immersive experience.

### 📄 Visual LaTeX Resume Builder
*   **Block-Based Editor**: Build your resume using intuitive visual blocks (Education, Experience, Projects, etc.) without needing to know LaTeX.
*   **Real-Time Compilation**: The backend instantly compiles your blocks into a beautifully formatted, flush-left LaTeX document.
*   **Cloud Sync**: Resumes are automatically synced and saved to Firebase Firestore.
*   **ATS Pre-Check**: Instantly get your resume reviewed by the AI analyzer right from the editor.

### 🕵️‍♂️ Aggressive ATS Resume Analyzer
*   **NVIDIA NIM & AI SDK**: Powered by cutting-edge LLMs to analyze your resume text against strict industry standards.
*   **Contextual Scoring**: Score your resume against a pasted Job Description or a manually configured target role.
*   **Actionable Feedback**: Receive a 1-100 ATS Score, a breakdown of strengths, areas to improve, and a checklist of missing keywords.

### 📊 Stored Data Dashboard
*   **Centralized Hub**: View analytics on your total mock interviews and ATS analyses.
*   **Review & Export**: Easily re-download generated LaTeX PDFs, review past ATS scores, and expand drop-down menus to view AI feedback without needing to re-run the analysis.

---

## 🛠️ Technology Stack

**Frontend**
*   [React 19](https://react.dev/) & [Vite](https://vitejs.dev/)
*   [Tailwind CSS v4](https://tailwindcss.com/) (Dark-Luxury-Tech UI design)
*   [Firebase SDK](https://firebase.google.com/) (Authentication & Firestore)
*   [Lucide React](https://lucide.dev/) (Iconography)
*   [Monaco Editor](https://microsoft.github.io/monaco-editor/) (For raw LaTeX editing, if needed)

**Backend**
*   [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
*   [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
*   [Vapi Web SDK](https://vapi.ai/) (Voice AI Integration)
*   [Vercel AI SDK](https://sdk.vercel.ai/docs) (LLM Integration via NVIDIA NIM)
*   `pdflatex` (System level dependency for PDF generation)

---

## 🚀 Getting Started

### Prerequisites

1.  **Node.js**: v18 or higher is recommended.
2.  **LaTeX Distribution**: You **must** have `pdflatex` installed on your system path for the backend to compile resumes.
    *   *Windows*: Install [MiKTeX](https://miktex.org/)
    *   *macOS*: Install [MacTeX](https://tug.org/mactex/)
    *   *Linux*: `sudo apt-get install texlive-latex-base texlive-fonts-recommended`

### Installation

1.  **Clone the repository**
2.  **Install Frontend Dependencies**
    ```bash
    cd frontend
    npm install
    ```
3.  **Install Backend Dependencies**
    ```bash
    cd backend
    npm install
    ```

### Environment Variables

You will need to set up `.env` files in both the `frontend` and `backend` directories.

**Backend (`backend/.env`)**
```env
PORT=5000
FRONTEND_URL=http://localhost:5173

# Vapi Assistant IDs
VAPI_COLLECTOR_ID="your_collector_id"
VAPI_INTERVIEWER_ID="your_interviewer_id"

# NVIDIA NIM LLM Key
NVIDIA_API_KEY="your_nvidia_api_key"

# Firebase Admin SDK
FIREBASE_PROJECT_ID="your_project_id"
FIREBASE_CLIENT_EMAIL="your_client_email"
FIREBASE_PRIVATE_KEY="your_private_key"
```

**Frontend (`frontend/.env`)**
```env
VITE_BACKEND_URL=http://localhost:5000
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_auth_domain"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
VITE_FIREBASE_APP_ID="your_app_id"
```

### Running the Application

1.  **Start the Backend Server**
    ```bash
    cd backend
    node index.js
    ```
2.  **Start the Frontend Dev Server**
    ```bash
    cd frontend
    npm run dev
    ```
3.  **Open the App**: Navigate to `http://localhost:5173` in your browser.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](#) if you want to contribute.

## 📝 License

This project is licensed under the MIT License.
