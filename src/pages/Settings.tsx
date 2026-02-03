import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { youtubeService } from '../services/youtubeService';
import { supabase } from '../services/supabaseClient';
import { dbService } from '../services/dbService';
import { Auth } from '../components/Auth';
import { Key, Trash2, User, LogOut, Cloud } from 'lucide-react';
import './Settings.css';

const Settings = () => {
    const { apiKey, setApiKey, isValidated, setIsValidated, user, setUser, setSession, library } = useAppStore();
    const [inputValue, setInputValue] = useState(apiKey);
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState('');

    const handleValidate = async () => {
        if (!inputValue) {
            setMessage('API 키를 입력해주세요.');
            return;
        }

        setIsChecking(true);
        setMessage('검색 중...');

        const isValid = await youtubeService.validateApiKey(inputValue);

        setIsChecking(false);
        if (isValid) {
            setApiKey(inputValue);
            setIsValidated(true);
            setMessage('✅ API 키가 유효합니다.');

            // Sync to Supabase if logged in
            if (user) {
                try {
                    await dbService.updateProfile(user.id, user.email!, inputValue);
                } catch (error) {
                    console.error('Profile sync failed:', error);
                }
            }
        } else {
            setIsValidated(false);
            setMessage('❌ 유효하지 않은 API 키입니다. 다시 확인해주세요.');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    const handleClearData = () => {
        if (window.confirm('모든 로컬 데이터를 초기화하시겠습니까? (보관함 및 API 키 포함)')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="page-container settings-page">
            <div className="header-section">
                <h1>설정</h1>
                <p>앱 구성 및 계정 관리를 수행합니다.</p>
            </div>

            <div className="settings-grid">
                <section className="settings-column">
                    <div className="settings-card glass">
                        <div className="card-header">
                            <Key size={20} />
                            <h3>API 설정</h3>
                        </div>
                        <div className="input-group">
                            <label htmlFor="api-key">YouTube API Key</label>
                            <div className="input-wrapper">
                                <input
                                    id="api-key"
                                    type="password"
                                    placeholder="API 키를 입력하세요..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleValidate}
                                    disabled={isChecking}
                                >
                                    {isChecking ? '확인 중...' : '연결 확인'}
                                </button>
                            </div>
                            {message && (
                                <div className={`status-message ${isValidated ? 'success' : 'error'}`}>
                                    {message}
                                </div>
                            )}
                        </div>

                        <div className="info-box">
                            <h4>API 키 발급 방법</h4>
                            <ul>
                                <li><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a> 접속</li>
                                <li><strong>YouTube Data API v3</strong> 활성화</li>
                                <li>사용자 인증 정보에서 <strong>API 키</strong> 생성</li>
                            </ul>
                        </div>
                    </div>

                    <div className="danger-zone glass">
                        <div className="card-header">
                            <Trash2 size={20} />
                            <h3>데이터 관리</h3>
                        </div>
                        <p>브라우저의 모든 보관함 데이터를 삭제합니다.</p>
                        <button className="btn btn-danger" onClick={handleClearData}>
                            <Trash2 size={18} /> 모든 데이터 초기화
                        </button>
                    </div>
                </section>

                <section className="settings-column">
                    <div className="settings-card glass">
                        <div className="card-header">
                            <User size={20} />
                            <h3>계정 및 동기화</h3>
                        </div>

                        {user ? (
                            <div className="user-profile">
                                <div className="user-info">
                                    <div className="user-avatar">
                                        {user.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="user-details">
                                        <div className="user-email">{user.email}</div>
                                        <div className="sync-status">
                                            <Cloud size={14} /> 실시간 동기화 중
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
                                    <LogOut size={18} /> 로그아웃
                                </button>
                            </div>
                        ) : (
                            <Auth />
                        )}
                    </div>

                    {user && (
                        <div className="sync-info glass">
                            <h4>동기화 정보</h4>
                            <p>현재 보관함의 {library.length}개 항목이 클라우드에 안전하게 보관되고 있습니다.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Settings;
