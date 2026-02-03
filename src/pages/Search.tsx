import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore, type SavedItem, formatNumber, formatDuration } from '../store/useAppStore';
import { youtubeService } from '../services/youtubeService';
import { dbService } from '../services/dbService';
import { Search as SearchIcon, Filter, Save, Download, Calendar, Clock, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Search.css';

const Search = () => {
    const { apiKey, isValidated, addToLibrary, searchState, setSearchState } = useAppStore();

    // Provide defaults for all persisted search state fields to prevent crashes on first-time hydration
    // Provide defaults and validate types for persisted state
    const {
        query = '',
        results: _results = [],
        selectedRegions: _selectedRegions = ['KR'],
        publishedAfter = '',
        duration = 'any',
        sortKey = 'publishedAt',
        sortOrder = 'desc',
        minContribution = 0,
        minPerformance = 0,
        resultsQuery = ''
    } = searchState || {};

    // Enforce array types to prevent crashes from corrupted state
    const results = Array.isArray(_results) ? _results : [];
    const selectedRegions = Array.isArray(_selectedRegions) ? _selectedRegions : ['KR'];

    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Regions list (fetched once)
    const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);

    const dateInputRef = useRef<HTMLInputElement>(null);

    const handleCalendarClick = () => {
        if (dateInputRef.current) {
            try {
                // showPicker() is the modern and most reliable way
                if ('showPicker' in HTMLInputElement.prototype) {
                    dateInputRef.current.showPicker();
                } else {
                    dateInputRef.current.focus();
                }
            } catch (error) {
                console.error('showPicker failed:', error);
                dateInputRef.current.focus();
            }
        }
    };

    const parseDurationToSeconds = (durationStr: string): number => {
        const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);
        const seconds = parseInt(match[3] || '0', 10);
        return hours * 3600 + minutes * 60 + seconds;
    };

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSearchState({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
        } else {
            setSearchState({ sortKey: key, sortOrder: 'desc' });
        }
    };

    const calculateMetrics = (item: any) => {
        if (!item) return { performanceRatio: 0, contributionScore: 0 };

        const stats = item.statistics || {};
        const cStats = item.channelStatistics || {};

        const viewCount = parseInt(String(stats.viewCount || '0'), 10) || 0;
        const subCount = parseInt(String(cStats.subscriberCount || '0'), 10) || 0;
        const totalViews = parseInt(String(cStats.viewCount || '0'), 10) || 0;

        // Performance Ratio: Views per Subscriber
        const performanceRatio = subCount > 0 ? viewCount / subCount : 0;

        // Contribution Score: Video Views / Channel Total Views
        const contributionScore = totalViews > 0 ? (viewCount / totalViews) * 100 : 0;

        return { performanceRatio, contributionScore };
    };

    const filteredResults = useMemo(() => {
        const baseResults = results || [];

        // 1. Pre-calculate metrics once per item
        const resultsWithMetrics = baseResults.map(item => ({
            ...item,
            _computedMetrics: calculateMetrics(item)
        }));

        // 2. Filter
        const filtered = resultsWithMetrics.filter(item => {
            const metrics = item._computedMetrics;
            const title = item.snippet?.title || '';
            const channel = item.snippet?.channelTitle || '';

            // Text search (Title or Channel)
            const matchesQuery = !resultsQuery ||
                title.toLowerCase().includes(resultsQuery.toLowerCase()) ||
                channel.toLowerCase().includes(resultsQuery.toLowerCase());

            // Metrics thresholds
            const matchesContribution = metrics.contributionScore >= minContribution;
            const matchesPerformance = metrics.performanceRatio >= minPerformance;

            return matchesQuery && matchesContribution && matchesPerformance;
        });

        // 3. Sort
        const sorted = [...filtered].sort((a, b) => {
            let valA: any;
            let valB: any;

            try {
                switch (sortKey) {
                    case 'title':
                        valA = (a.snippet?.title || '').toLowerCase();
                        valB = (b.snippet?.title || '').toLowerCase();
                        break;
                    case 'duration':
                        valA = parseDurationToSeconds(a.contentDetails?.duration || '');
                        valB = parseDurationToSeconds(b.contentDetails?.duration || '');
                        break;
                    case 'subscribers':
                        valA = parseInt(String(a.channelStatistics?.subscriberCount || '0'), 10) || 0;
                        valB = parseInt(String(b.channelStatistics?.subscriberCount || '0'), 10) || 0;
                        break;
                    case 'views':
                        valA = parseInt(String(a.statistics?.viewCount || '0'), 10) || 0;
                        valB = parseInt(String(b.statistics?.viewCount || '0'), 10) || 0;
                        break;
                    case 'likes':
                        valA = parseInt(String(a.statistics?.likeCount || '0'), 10) || 0;
                        valB = parseInt(String(b.statistics?.likeCount || '0'), 10) || 0;
                        break;
                    case 'contribution':
                        valA = a._computedMetrics.contributionScore;
                        valB = b._computedMetrics.contributionScore;
                        break;
                    case 'performance':
                        valA = a._computedMetrics.performanceRatio;
                        valB = b._computedMetrics.performanceRatio;
                        break;
                    case 'publishedAt':
                        valA = new Date(a.snippet?.publishedAt || 0).getTime();
                        valB = new Date(b.snippet?.publishedAt || 0).getTime();
                        break;
                    default:
                        return 0;
                }

                if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            } catch (err) {
                console.error('Sorting error:', err);
                return 0;
            }
        });
        return sorted;
    }, [results, resultsQuery, minContribution, minPerformance, sortKey, sortOrder]);

    const toggleAllRegions = (select: boolean) => {
        if (select) setSearchState({ selectedRegions: (regions || []).map(r => r.id) });
        else setSearchState({ selectedRegions: [] });
    };

    useEffect(() => {
        if (isValidated && apiKey) {
            youtubeService.getRegions(apiKey).then(data => {
                const sorted = data.sort((a: any, b: any) => {
                    if (a.id === 'KR') return -1;
                    if (b.id === 'KR') return 1;
                    return a.name.localeCompare(b.name);
                });
                setRegions(sorted);
            });
        }
    }, [isValidated, apiKey]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!isValidated || !query) return;

        setIsLoading(true);
        setLoadingStatus('검색을 준비 중입니다...');
        setSearchState({
            results: [],
            resultsQuery: ''
        });
        setSelectedItems(new Set());

        try {
            const commonParams: any = {};
            if (publishedAfter) {
                const date = new Date(publishedAfter);
                if (!isNaN(date.getTime())) {
                    commonParams.publishedAfter = date.toISOString();
                }
            }
            if (duration !== 'any') commonParams.videoDuration = duration;

            setLoadingStatus(`${selectedRegions.length || 1}개 지역의 영상을 검색 중입니다...`);
            const data = await youtubeService.searchMultiRegion(apiKey, query, selectedRegions, commonParams);

            setSearchState({
                results: data.items || [],
                resultsQuery: '',
            });

            if (!data.items || data.items.length === 0) {
                alert('검색 결과가 없습니다.');
            }
        } catch (error: any) {
            console.error('Search main error:', error);
            const msg = error.response?.data?.error?.message || '검색 중 오류가 발생했습니다.';
            alert(`${msg} (API 할당량 초과 여부를 확인해 주세요)`);
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
    };

    const toggleSelectAll = () => {
        const currentResults = filteredResults || [];
        if (currentResults.length > 0 && selectedItems.size === currentResults.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set((currentResults || []).map(item => item.id?.videoId || item.id)));
        }
    };

    const handleSaveToLibrary = async () => {
        setIsSaving(true);
        const { user } = useAppStore.getState();

        const itemsToSave: SavedItem[] = (results || [])
            .map(item => {
                const metrics = calculateMetrics(item);
                const videoId = item.id?.videoId || item.id;
                if (!videoId) return null;

                return {
                    id: videoId,
                    title: item.snippet?.title || 'Unknown Title',
                    thumbnail: item.snippet?.thumbnails?.medium?.url || '',
                    channelTitle: item.snippet?.channelTitle || 'Unknown Channel',
                    channelId: item.snippet?.channelId || '',
                    publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
                    description: item.snippet?.description || '',
                    tags: [] as string[],
                    note: '',
                    savedAt: new Date().toISOString(),
                    viewCount: item.statistics?.viewCount || '0',
                    likeCount: item.statistics?.likeCount || '0',
                    duration: item.contentDetails?.duration || '',
                    subscriberCount: item.channelStatistics?.subscriberCount || '0',
                    channelTotalViews: item.channelStatistics?.viewCount || '0',
                    performanceRatio: metrics.performanceRatio,
                    contributionScore: metrics.contributionScore
                };
            })
            .filter((item): item is SavedItem => item !== null);

        try {
            if (user) {
                await dbService.saveVideos(user.id, itemsToSave);
            }
            addToLibrary(itemsToSave);
            setSelectedItems(new Set());
            alert(`${itemsToSave.length}개의 영상이 보관함에 저장되었습니다.`);
        } catch (error) {
            console.error('Save failed:', error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        const dataToExport = filteredResults
            .filter(item => {
                const videoId = item.id?.videoId || item.id;
                return selectedItems.size === 0 || selectedItems.has(videoId);
            })
            .map(item => {
                const metrics = calculateMetrics(item);
                const videoId = item.id?.videoId || item.id;
                return {
                    'No': videoId,
                    '제목': item.snippet?.title || '',
                    '채널명': item.snippet?.channelTitle || '',
                    '업로드 날짜': item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).toLocaleDateString() : '',
                    '구독자수': item.channelStatistics?.subscriberCount || '0',
                    '조회수': item.statistics?.viewCount || '0',
                    '좋아요 수': item.statistics?.likeCount || '0',
                    '영상 길이': formatDuration(item.contentDetails?.duration || ''),
                    '채널 기여도(%)': (metrics.contributionScore || 0).toFixed(2),
                    '성과도 배율': (metrics.performanceRatio || 0).toFixed(2),
                    '국가': item.searchRegion || 'GL',
                    '링크': videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''
                };
            });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TubeInsight_Search');
        XLSX.writeFile(wb, `TubeInsight_Search_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            <aside className="filter-sidebar glass">
                <div className="sidebar-header">
                    <Filter size={18} />
                    <h3>필터 상세 설정</h3>
                </div>

                <div className="filter-group">
                    <label><SearchIcon size={16} /> 결과 내 검색</label>
                    <input
                        type="text"
                        placeholder="제목 또는 채널명..."
                        value={resultsQuery}
                        onChange={(e) => setSearchState({ resultsQuery: e.target.value })}
                        className="results-search-input"
                    />
                </div>

                <div className="filter-group">
                    <label><Calendar size={16} /> 업로드 날짜 이후</label>
                    <div className="date-input-group">
                        <input
                            type="text"
                            placeholder="YYYY-MM-DD"
                            value={publishedAfter}
                            onChange={(e) => setSearchState({ publishedAfter: e.target.value })}
                            className="date-text-input"
                        />
                        <button type="button" className="calendar-picker-wrapper" onClick={handleCalendarClick}>
                            <input
                                type="date"
                                ref={dateInputRef}
                                value={publishedAfter}
                                onChange={(e) => setSearchState({ publishedAfter: e.target.value })}
                                className="hidden-date-picker"
                            />
                            <Calendar size={18} className="calendar-icon-btn" />
                        </button>
                    </div>
                </div>
                <div className="filter-group">
                    <label><Clock size={16} /> 영상 길이</label>
                    <select value={duration} onChange={(e) => setSearchState({ duration: e.target.value })}>
                        <option value="any">모든 길이</option>
                        <option value="short">4분 미만</option>
                        <option value="medium">4분 ~ 20분</option>
                        <option value="long">20분 초과</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>최소 기여도 (%)</label>
                    <div className="threshold-input-group">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={minContribution}
                            onChange={(e) => setSearchState({ minContribution: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="unit">%</span>
                    </div>
                </div>

                <div className="filter-group">
                    <label>최소 성과도 (배율)</label>
                    <div className="threshold-input-group">
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={minPerformance}
                            onChange={(e) => setSearchState({ minPerformance: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="unit">x</span>
                    </div>
                </div>

                <div className="filter-group">
                    <div className="filter-label-row">
                        <label><MapPin size={16} /> 대상 국가 ({selectedRegions.length})</label>
                        <div className="region-controls">
                            <button className="text-btn" onClick={() => toggleAllRegions(true)}>전체</button>
                            <button className="text-btn" onClick={() => toggleAllRegions(false)}>해제</button>
                        </div>
                    </div>
                    {selectedRegions.length > 5 && (
                        <div className="quota-warning">
                            <strong>⚠️ 할당량 주의</strong>
                            <p>다국어 검색 시 API 할당량이 많이 소모됩니다. (현재 약 {selectedRegions.length * 100} units 소모 예상)</p>
                        </div>
                    )}
                    <div className="region-selector-list glass">
                        {regions.length === 0 ? (
                            <div className="loading-regions">국가 목록을 불러오는 중...</div>
                        ) : (
                            (regions || []).map(region => (
                                <label key={region.id} className="region-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedRegions.includes(region.id)}
                                        onChange={() => {
                                            const newRegions = selectedRegions.includes(region.id)
                                                ? selectedRegions.filter(r => r !== region.id)
                                                : [...selectedRegions, region.id];
                                            setSearchState({ selectedRegions: newRegions });
                                        }}
                                    />
                                    <span>{region.name} ({region.id})</span>
                                </label>
                            ))
                        )}
                    </div>
                </div>
            </aside>

            <main className="search-main">
                <header className="search-header glass">
                    <form className="search-input-form" onSubmit={handleSearch}>
                        <SearchIcon size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="검색어를 입력하세요..."
                            value={query}
                            onChange={(e) => setSearchState({ query: e.target.value })}
                        />
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? '검색 중...' : '검색'}
                        </button>
                    </form>
                    {isLoading && loadingStatus && (
                        <div className="search-status-bar">
                            <div className="spinner-small"></div>
                            <span>{loadingStatus}</span>
                        </div>
                    )}
                    <div className="action-bar">
                        <span className="selected-count">{selectedItems.size}개 선택됨</span>
                        <div className="action-buttons">
                            <button className="btn btn-secondary" disabled={selectedItems.size === 0 || isSaving} onClick={handleSaveToLibrary}>
                                <Save size={18} /> {isSaving ? '저장 중...' : '보관함 저장'}
                            </button>
                            <button className="btn btn-secondary" disabled={selectedItems.size === 0} onClick={handleExport}>
                                <Download size={18} /> {selectedItems.size > 0 ? `${selectedItems.size}개 내보내기` : '내보내기'}
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
                                        checked={(filteredResults || []).length > 0 && selectedItems.size === (filteredResults || []).length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th>No.</th>
                                <th>썸네일</th>
                                <th className="sortable-header" onClick={() => handleSort('title')}>
                                    제목 / 채널 {sortKey === 'title' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('duration')}>
                                    길이 {sortKey === 'duration' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('subscribers')}>
                                    구독자 {sortKey === 'subscribers' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('views')}>
                                    조회수 {sortKey === 'views' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('likes')}>
                                    좋아요 {sortKey === 'likes' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('contribution')}>
                                    기여도 {sortKey === 'contribution' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('performance')}>
                                    성과도 {sortKey === 'performance' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th className="sortable-header" onClick={() => handleSort('publishedAt')}>
                                    업로드일 {sortKey === 'publishedAt' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                </th>
                                <th>국가</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(filteredResults || []).map((item, idx) => {
                                if (!item) return null;
                                const metrics = calculateMetrics(item);
                                const videoId = item.id?.videoId || item.id;
                                if (!videoId) return null;

                                return (
                                    <tr key={videoId} className={selectedItems.has(videoId) ? 'selected' : ''} onClick={() => toggleSelect(videoId)}>
                                        <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedItems.has(videoId)} onChange={() => toggleSelect(videoId)} />
                                        </td>
                                        <td>{idx + 1}</td>
                                        <td className="col-thumb">
                                            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">
                                                <img src={item.snippet?.thumbnails?.medium?.url} alt="" />
                                            </a>
                                        </td>
                                        <td>
                                            <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="video-link">
                                                <div className="video-title">{item.snippet?.title}</div>
                                            </a>
                                            <a href={`https://www.youtube.com/channel/${item.snippet?.channelId}`} target="_blank" rel="noopener noreferrer" className="channel-link">
                                                <div className="channel-name-small">{item.snippet?.channelTitle}</div>
                                            </a>
                                        </td>
                                        <td>{formatDuration(item.contentDetails?.duration || '')}</td>
                                        <td>{formatNumber(item.channelStatistics?.subscriberCount || '0')}</td>
                                        <td>{formatNumber(item.statistics?.viewCount || '0')}</td>
                                        <td>{formatNumber(item.statistics?.likeCount || '0')}</td>
                                        <td>{(metrics.contributionScore || 0).toFixed(2)}%</td>
                                        <td className={`perf-badge ${(metrics.performanceRatio || 0) >= 1 ? 'high' : ''}`}>
                                            x{(metrics.performanceRatio || 0).toFixed(1)}
                                        </td>
                                        <td>{item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).toLocaleDateString() : '-'}</td>
                                        <td>
                                            <span className="region-badge">{item.searchRegion || 'GL'}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default Search;
