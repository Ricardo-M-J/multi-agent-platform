import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectMonitorPage } from './pages/ProjectMonitorPage';
import { AgentManagerPage } from './pages/AgentManagerPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agents" element={<AgentManagerPage />} />
            <Route path="/monitor/:projectId" element={<ProjectMonitorPage />} />
            <Route path="/monitor" element={<ProjectMonitorPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
