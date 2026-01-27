import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { youtubeService } from '../services/youtubeService';
import { Key, Trash2 } from 'lucide-react';
import './Settings.css';

const Settings = () => {
    const { apiKey, setApiKey, isValidated, setIsValidated } = useAppStore();
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
        } else {
            setIsValidated(false);
            setMessage('❌ 유효하지 않은 API 키입니다. 다시 확인해주세요.');
        }
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
                <p>앱을 사용하기 위해 YouTube Data API v3 키를 구성하세요.</p>
            </div>

            <div className="settings-card glass">
                <div className="input-group">
                    <label htmlFor="api-key">
                        <Key size={18} />
                        YouTube API Key
                    </label>
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
                    <h3>도움말: API 키 발급 방법</h3>
                    <ul>
                        <li><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>에 접속합니다.</li>
                        <li>새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.</li>
                        <li><strong>YouTube Data API v3</strong>를 활성화합니다.</li>
                        <li>사용자 인증 정보 메뉴에서 <strong>API 키</strong>를 생성합니다.</li>
                    </ul>
                </div>
            </div>

            <div className="danger-zone glass">
                <h3>데이터 관리</h3>
                <p>브라우저에 저장된 모든 정보를 삭제합니다.</p>
                <button className="btn btn-danger" onClick={handleClearData}>
                    <Trash2 size={18} />
                    모든 데이터 초기화
                </button>
            </div>
        </div>
    );
};

export default Settings;
