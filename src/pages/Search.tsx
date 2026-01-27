import { useState } from 'react';
import { useAppStore, type SavedItem } from '../store/useAppStore';
import { youtubeService } from '../services/youtubeService';
import { Search as SearchIcon, Filter, Save, Download, Calendar, Clock, Globe } from 'lucide-react';
import './Search.css';

const Search = () => {
    const { apiKey, isValidated, addToLibrary } = useAppStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Filters
    const [publishedAfter, setPublishedAfter] = useState('');
    const [duration, setDuration] = useState('any');
    const [relevanceLanguage, setRelevanceLanguage] = useState('ko');

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!isValidated || !query) return;

        setIsLoading(true);
        try {
            const params: any = {
                relevanceLanguage,
            };
            if (publishedAfter) params.publishedAfter = new Date(publishedAfter).toISOString();
            if (duration !== 'any') params.videoDuration = duration;

            const data = await youtubeService.searchVideos(apiKey, query, params);
            setResults(data.items || []);
        } catch (error) {
            alert('검색 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === results.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(results.map(item => item.id.videoId)));
        }
    };

    const handleSaveToLibrary = () => {
        setIsSaving(true);
        const itemsToSave: SavedItem[] = results
            .filter(item => selectedItems.has(item.id.videoId))
            .map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt,
                description: item.snippet.description,
                tags: [],
                note: '',
                savedAt: new Date().toISOString()
            }));

        addToLibrary(itemsToSave);
        setSelectedItems(new Set());
        setIsSaving(false);
        alert(`${itemsToSave.length}개의 영상이 보관함에 저장되었습니다.`);
    };

    if (!isValidated) {
        return (
            <div className="page-container search-empty">
                <div className="glass empty-card">
                    <SearchIcon size={48} />
                    <h2>API 키가 필요합니다</h2>
                    <p>검색 기능을 사용하려면 설정 페이지에서 유효한 YouTube API 키를 입력해주세요.</p>
                    <a href="/settings" className="btn btn-primary">설정으로 이동</a>
                </div>
            </div>
        );
    }

    return (
        <div className="search-layout">
            {/* Sidebar: Filters */}
            <aside className="filter-sidebar glass">
                <div className="sidebar-header">
                    <Filter size={18} />
                    <h3>필터 상세 설정</h3>
                </div>

                <div className="filter-group">
                    <label><Calendar size={16} /> 업로드 날짜 이후</label>
                    <input type="date" value={publishedAfter} onChange={(e) => setPublishedAfter(e.target.value)} />
                </div>

                <div className="filter-group">
                    <label><Clock size={16} /> 영상 길이</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                        <option value="any">모든 길이</option>
                        <option value="short">4분 미만</option>
                        <option value="medium">4분 ~ 20분</option>
                        <option value="long">20분 초과</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label><Globe size={16} /> 언어 (Relevance)</label>
                    <select value={relevanceLanguage} onChange={(e) => setRelevanceLanguage(e.target.value)}>
                        <option value="ko">한국어</option>
                        <option value="en">영어</option>
                        <option value="ja">일본어</option>
                    </select>
                </div>
            </aside>

            {/* Main Content */}
            <main className="search-main">
                <header className="search-header glass">
                    <form className="search-input-form" onSubmit={handleSearch}>
                        <SearchIcon size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="검색어를 입력하세요 (예: AI Trend, K-POP...)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? '검색 중...' : '검색'}
                        </button>
                    </form>

                    <div className="action-bar">
                        <span className="selected-count">{selectedItems.size}개 선택됨</span>
                        <div className="action-buttons">
                            <button
                                className="btn btn-secondary"
                                disabled={selectedItems.size === 0 || isSaving}
                                onClick={handleSaveToLibrary}
                            >
                                <Save size={18} />
                                {isSaving ? '저장 중...' : '보관함 저장'}
                            </button>
                            <button className="btn btn-secondary" disabled={selectedItems.size === 0}>
                                <Download size={18} />
                                내보내기
                            </button>
                        </div>
                    </div>
                </header>

                <div className="results-container glass">
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th className="col-check">
                                    <input
                                        type="checkbox"
                                        checked={results.length > 0 && selectedItems.size === results.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="col-thumb">썸네일</th>
                                <th className="col-info">영상 정보</th>
                                <th className="col-channel">채널</th>
                                <th className="col-date">업로드일</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((item) => (
                                <tr
                                    key={item.id.videoId}
                                    className={selectedItems.has(item.id.videoId) ? 'selected' : ''}
                                    onClick={() => toggleSelect(item.id.videoId)}
                                >
                                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(item.id.videoId)}
                                            onChange={() => toggleSelect(item.id.videoId)}
                                        />
                                    </td>
                                    <td className="col-thumb">
                                        <img src={item.snippet.thumbnails.medium.url} alt={item.snippet.title} />
                                    </td>
                                    <td className="col-info">
                                        <div className="video-title">{item.snippet.title}</div>
                                        <div className="video-desc">{item.snippet.description}</div>
                                    </td>
                                    <td className="col-channel">{item.snippet.channelTitle}</td>
                                    <td className="col-date">
                                        {new Date(item.snippet.publishedAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && results.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="no-results">
                                        검색 결과가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default Search;
