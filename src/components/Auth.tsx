import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import './Auth.css';

export const Auth = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const { setUser, setSession } = useAppStore();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage({ type: 'success', text: '회원가입 확인 메일이 발송되었습니다.' });
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                setUser(data.user);
                setSession(data.session);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || '인증 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container glass">
            <div className="auth-header">
                <h2>{isSignUp ? '회원가입' : '로그인'}</h2>
                <p>데이터 동기화를 위해 계정이 필요합니다.</p>
            </div>

            <form onSubmit={handleAuth} className="auth-form">
                <div className="input-group">
                    <label><Mail size={16} /> 이메일</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        required
                    />
                </div>
                <div className="input-group">
                    <label><Lock size={16} /> 비밀번호</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </div>

                {message && (
                    <div className={`auth-message ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                    {loading ? '처리 중...' : (isSignUp ? <><UserPlus size={18} /> 가입하기</> : <><LogIn size={18} /> 로그인</>)}
                </button>
            </form>

            <div className="auth-footer">
                <button className="btn-link" onClick={() => setIsSignUp(!isSignUp)}>
                    {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
                </button>
            </div>
        </div>
    );
};
