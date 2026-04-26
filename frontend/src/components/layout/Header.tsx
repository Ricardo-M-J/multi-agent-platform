import { Link, useLocation } from 'react-router-dom';
import { Activity, Home, Zap } from 'lucide-react';

/**
 * 顶部导航栏
 */
export function Header() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <Zap size={22} />
          <span className="header-title">多智能体协作平台</span>
        </div>
      </div>

      <nav className="header-nav">
        <Link
          to="/"
          className={`header-nav-item ${isActive('/') ? 'active' : ''}`}
        >
          <Home size={16} />
          <span>项目列表</span>
        </Link>
        <Link
          to="/monitor"
          className={`header-nav-item ${isActive('/monitor') ? 'active' : ''}`}
        >
          <Activity size={16} />
          <span>项目监控</span>
        </Link>
      </nav>

      <div className="header-right">
        <div className="header-status">
          <span className="status-dot online" />
          <span>系统正常</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
