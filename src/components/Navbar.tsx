import { Link, useLocation } from 'react-router-dom';
import { Search, Library, Settings as SettingsIcon, Home } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="navbar glass">
            <div className="navbar-brand">
                <Link to="/">TubeInsight</Link>
            </div>
            <div className="navbar-links">
                <Link to="/" className={isActive('/') ? 'active' : ''}>
                    <Home size={20} />
                    <span>홈</span>
                </Link>
                <Link to="/search" className={isActive('/search') ? 'active' : ''}>
                    <Search size={20} />
                    <span>검색</span>
                </Link>
                <Link to="/library" className={isActive('/library') ? 'active' : ''}>
                    <Library size={20} />
                    <span>보관함</span>
                </Link>
                <Link to="/settings" className={isActive('/settings') ? 'active' : ''}>
                    <SettingsIcon size={20} />
                    <span>설정</span>
                </Link>
            </div>
        </nav>
    );
};

export default Navbar;
