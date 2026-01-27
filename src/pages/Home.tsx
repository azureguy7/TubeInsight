import { useAppStore } from '../store/useAppStore';
import { Search, Library, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
    const { library, isValidated } = useAppStore();

    const stats = [
        {
            label: '보관된 영상',
            value: library.length,
            icon: <Library className="stat-icon" />,
            color: 'blue'
        },
        {
            label: 'API 상태',
            value: isValidated ? '연결됨' : '연결 필요',
            icon: isValidated ? <CheckCircle2 className="stat-icon success" /> : <XCircle className="stat-icon error" />,
            color: isValidated ? 'green' : 'red'
        }
    ];

    return (
        <div className="page-container home-page">
            <div className="hero-section glass">
                <h1>TubeInsight</h1>
                <p>유튜브 데이터를 스마트하게 검색하고 아카이빙하세요.</p>
                <div className="hero-actions">
                    <Link to="/search" className="btn btn-primary">
                        <Search size={18} /> 시작하기
                    </Link>
                    {!isValidated && (
                        <Link to="/settings" className="btn btn-secondary">
                            API 키 설정하러 가기
                        </Link>
                    )}
                </div>
            </div>

            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <div key={index} className={`stat-card glass ${stat.color}`}>
                        <div className="stat-header">
                            {stat.icon}
                            <span className="stat-label">{stat.label}</span>
                        </div>
                        <div className="stat-value">{stat.value}</div>
                    </div>
                ))}
            </div>

            <div className="quick-guide glass">
                <h3>사용 가이드</h3>
                <div className="guide-items">
                    <div className="guide-item">
                        <span className="step">1</span>
                        <div>
                            <strong>API 연결</strong>
                            <p>설정 페이지에서 본인의 YouTube Data API 키를 등록합니다.</p>
                        </div>
                    </div>
                    <div className="guide-item">
                        <span className="step">2</span>
                        <div>
                            <strong>영상 검색</strong>
                            <p>고급 필터를 사용하여 원하는 영상을 정밀하게 찾아냅니다.</p>
                        </div>
                    </div>
                    <div className="guide-item">
                        <span className="step">3</span>
                        <div>
                            <strong>데이터 보관</strong>
                            <p>관심 있는 영상을 로컬 보관함에 저장하고 메모를 추가합니다.</p>
                        </div>
                    </div>
                    <div className="guide-item">
                        <span className="step">4</span>
                        <div>
                            <strong>엑셀 내보내기</strong>
                            <p>보관된 영상 데이터를 분석을 위해 엑셀로 한 번에 내보냅니다.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
