import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import SearchPage from './pages/SearchPage';
import AdminPage from './pages/AdminPage';
import IdentifyPage from './pages/IdentifyPage';
import FamiliesPage from "./pages/FamiliesPage.jsx";
import StadisticsPage from "./pages/StadisticsPage.jsx";
import ChatbotPage from "./pages/ChatbotPage.jsx";

export default function App() {
    const [isNavCollapsed, setIsNavCollapsed] = useState(true);

    const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
    const closeNav = () => setIsNavCollapsed(true);

    return (
        <BrowserRouter>
            <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
                <div className="container">
                    <Link to="/" className="navbar-brand d-flex align-items-center" onClick={closeNav}>
                        <img
                            src="/logo-popoyan.png"
                            alt="Logo"
                            style={{ height: 32, width: 'auto' }}
                            className="me-2"
                        />
                    </Link>

                    {/* Botón hamburguesa */}
                    <button
                        className="navbar-toggler"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#navbarNav"
                        aria-controls="navbarNav"
                        aria-expanded={!isNavCollapsed}
                        aria-label="Toggle navigation"
                        onClick={handleNavCollapse}
                    >
                        <span className="navbar-toggler-icon"></span>
                    </button>

                    {/* Menú colapsable */}
                    <div
                        className={`collapse navbar-collapse${!isNavCollapsed ? ' show' : ''}`}
                        id="navbarNav"
                    >
                        <div className="navbar-nav ms-auto">
                            <Link
                                to="/"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-camera me-2"></i>Buscar por Imagen
                            </Link>
                            <Link
                                to="/search"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-search me-2"></i>Buscar por Nombre
                            </Link>
                            <Link
                                to="/admin"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-cog me-2"></i>Administrar Plantas
                            </Link>
                            <Link
                                to="/families"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-sitemap me-2"></i>Familias
                            </Link>
                            <Link
                                to="/stats"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-chart-bar me-2"></i>Estadísticas
                            </Link>
                            <Link
                                to="/chat"
                                className="nav-link"
                                onClick={closeNav}
                            >
                                <i className="fas fa-robot me-2"></i>Chatbot
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="container mt-4">
                <Routes>
                    <Route path="/" element={<IdentifyPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/families" element={<FamiliesPage />} />
                    <Route path="/stats" element={<StadisticsPage />}/>
                    <Route path="/chat" element={<ChatbotPage />}/>
                </Routes>
            </div>
        </BrowserRouter>
    );
}