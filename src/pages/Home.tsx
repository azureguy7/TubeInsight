import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Library, CheckCircle2, XCircle, TrendingUp, Clock, History, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
    const { library, isValidated } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    const handleQuickSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    // Calculate some stats
    const recentVideos = [...library].sort((a, b) =>
        new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    ).slice(0, 4);

    const channels = Array.from(new Set(library.map(v => v.channelId))).length;

    const stats = [
        {
            label: '보관된 영상',
            value: library.length,
            icon: <Library size={20} />,
            color: 'blue'
        },
        {
            label: '등록된 채널',
            value: channels,
            icon: <TrendingUp size={20} />,
            color: 'purple'
        },
        {
            label: '최근 저장 (24h)',
            value: library.filter(v => {
                const dayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
                return new Date(v.savedAt).getTime() > dayAgo;
            }).length,
            icon: <Clock size={20} />,
            color: 'orange'
        },
        {
            label: 'API 상태',
            value: isValidated ? '연결됨' : '연결 필요',
            icon: isValidated ? <CheckCircle2 size={20} /> : <XCircle size={20} />,
            color: isValidated ? 'green' : 'red'
        }
    ];

    return (
        <div className="page-container home-page">
            <header className="hero-section">
                <h1>TubeInsight</h1>
                <p>유튜브 데이터를 정밀하게 분석하고 나만의 지식 라이브러리를 구축하세요.</p>

                <form className="quick-search-container" onSubmit={handleQuickSearch}>
                    <Search className="search-icon-overlay" size={20} />
                    <input
                        type="text"
                        className="quick-search-input"
                        placeholder="키워드를 입력하여 즉시 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </form>

                {!isValidated && (
                    <Link to="/settings" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
                        API 키 설정하기
                    </Link>
                )}
            </header>

            <section className="dashboard-grid">
                {stats.map((stat, index) => (
                    <div key={index} className={`stat-card glass ${stat.color}`}>
                        <div className="stat-header">
                            <div className="stat-icon-bg">
                                {stat.icon}
                            </div>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                        <div className="stat-value">{stat.value}</div>
                    </div>
                ))}
            </section>

            <section className="recent-activity glass">
                <div className="section-header">
                    <h2><History size={24} style={{ verticalAlign: 'middle', marginRight: '10px' }} /> 최근 활동</h2>
                    <Link to="/library" className="btn-text">
                        전체 보기 <ArrowRight size={16} />
                    </Link>
                </div>

                {recentVideos.length > 0 ? (
                    <div className="activity-list">
                        {recentVideos.map((video) => (
                            <Link to="/library" key={video.id} className="activity-card">
                                <img src={video.thumbnail} alt={video.title} className="activity-thumb" />
                                <div className="activity-info">
                                    <h4 className="activity-title">{video.title}</h4>
                                    <p className="activity-date">{new Date(video.savedAt).toLocaleDateString()}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>아직 저장된 영상이 없습니다. 검색을 통해 영상을 추가해보세요!</p>
                        <Link to="/search" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                            영상 검색하러 가기
                        </Link>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Home;
