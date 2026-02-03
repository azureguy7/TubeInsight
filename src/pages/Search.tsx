import { useState, useEffect } from 'react';
import { useAppStore, type SavedItem, formatNumber, formatDuration } from '../store/useAppStore';
import { youtubeService } from '../services/youtubeService';
import { dbService } from '../services/dbService';
import { Search as SearchIcon, Filter, Save, Download, Calendar, Clock, MapPin } from 'lucide-react';
import './Search.css';

const Search = () => {
    const { apiKey, isValidated, addToLibrary } = useAppStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // Regions
    const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
    const [selectedRegions, setSelectedRegions] = useState<string[]>(['KR']);

    // Filters
    const [publishedAfter, setPublishedAfter] = useState('');
    const [duration, setDuration] = useState('any');

    useEffect(() => {
        if (isValidated && apiKey) {
            youtubeService.getRegions(apiKey).then(data => {
                // Sort regions to put Korea at top if available
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
        try {
            const commonParams: any = {};
            if (publishedAfter) commonParams.publishedAfter = new Date(publishedAfter).toISOString();
            if (duration !== 'any') commonParams.videoDuration = duration;

            let allMergedItems: any[] = [];
            const seenVideoIds = new Set<string>();

            // Multi-Region Search Loop
            const regionList = selectedRegions.length > 0 ? selectedRegions : ['KR'];

            for (const regionCode of regionList) {
                const data = await youtubeService.searchVideos(apiKey, query, {
                    ...commonParams,
                    regionCode
                });

                if (data.items) {
                    data.items.forEach((item: any) => {
                        if (!seenVideoIds.has(item.id.videoId)) {
                            seenVideoIds.add(item.id.videoId);
                            allMergedItems.push(item);
                        }
                    });
                }
            }

            setResults(allMergedItems);
        } catch (error) {
            alert('검색 중 오류가 발생했습니다. (API 할당량 초과 여부를 확인해 주세요)');
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

    const calculateMetrics = (item: any) => {
        const viewCount = parseInt(item.statistics?.viewCount || '0', 10);
        const subCount = parseInt(item.channelStatistics?.subscriberCount || '1', 10);
        const totalViews = parseInt(item.channelStatistics?.viewCount || '1', 10);

        return {
            performanceRatio: viewCount / subCount,
            contributionScore: (viewCount / totalViews) * 100
        };
    };

    const handleSaveToLibrary = async () => {
        setIsSaving(true);
        const { user } = useAppStore.getState();

        const itemsToSave: SavedItem[] = results
            .filter(item => selectedItems.has(item.id.videoId))
            .map(item => {
                const metrics = calculateMetrics(item);
                return {
                    id: item.id.videoId,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium.url,
                    channelTitle: item.snippet.channelTitle,
                    channelId: item.snippet.channelId,
                    publishedAt: item.snippet.publishedAt,
                    description: item.snippet.description,
                    tags: [],
                    note: '',
                    savedAt: new Date().toISOString(),
                    viewCount: item.statistics.viewCount || '0',
                    likeCount: item.statistics.likeCount || '0',
                    duration: item.contentDetails.duration || '',
                    subscriberCount: item.channelStatistics.subscriberCount || '0',
                    channelTotalViews: item.channelStatistics.viewCount || '0',
                    performanceRatio: metrics.performanceRatio,
                    contributionScore: metrics.contributionScore
                };
            });

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
                    <label><Calendar size={16} /> 업로드 날짜 이후</label>
                    <div className="date-input-group">
                        <input
                            type="text"
                            placeholder="YYYY-MM-DD"
                            value={publishedAfter}
                            onChange={(e) => setPublishedAfter(e.target.value)}
                            className="date-text-input"
                        />
                        <div className="calendar-picker-wrapper">
                            <input
                                type="date"
                                value={publishedAfter}
                                onChange={(e) => setPublishedAfter(e.target.value)}
                                className="hidden-date-picker"
                            />
                            <Calendar size={18} className="calendar-icon-btn" />
                        </div>
                    </div>
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
                    <label><MapPin size={16} /> 대상 국가 (중복 선택)</label>
                    <div className="region-selector-list glass">
                        {regions.map(region => (
                            <label key={region.id} className="region-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedRegions.includes(region.id)}
                                    onChange={() => {
                                        setSelectedRegions(prev =>
                                            prev.includes(region.id)
                                                ? prev.filter(r => r !== region.id)
                                                : [...prev, region.id]
                                        );
                                    }}
                                />
                                <span>{region.name} ({region.id})</span>
                            </label>
                        ))}
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
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? '검색 중...' : '검색'}
                        </button>
                    </form>
                    <div className="action-bar">
                        <span className="selected-count">{selectedItems.size}개 선택됨</span>
                        <div className="action-buttons">
                            <button className="btn btn-secondary" disabled={selectedItems.size === 0 || isSaving} onClick={handleSaveToLibrary}>
                                <Save size={18} /> {isSaving ? '저장 중...' : '보관함 저장'}
                            </button>
                            <button className="btn btn-secondary" disabled={selectedItems.size === 0}>
                                <Download size={18} /> 내보내기
                            </button>
                        </div>
                    </div>
                </header>

                <div className="results-container glass">
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th className="col-check">
                                    <input type="checkbox" checked={results.length > 0 && selectedItems.size === results.length} onChange={toggleSelectAll} />
                                </th>
                                <th>No.</th>
                                <th>썸네일</th>
                                <th>제목 / 채널</th>
                                <th>길이</th>
                                <th>구독자</th>
                                <th>조회수</th>
                                <th>좋아요</th>
                                <th>기여도</th>
                                <th>성과도</th>
                                <th>업로드일</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((item, idx) => {
                                const metrics = calculateMetrics(item);
                                return (
                                    <tr key={item.id.videoId} className={selectedItems.has(item.id.videoId) ? 'selected' : ''} onClick={() => toggleSelect(item.id.videoId)}>
                                        <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedItems.has(item.id.videoId)} onChange={() => toggleSelect(item.id.videoId)} />
                                        </td>
                                        <td>{idx + 1}</td>
                                        <td className="col-thumb">
                                            <a href={`https://www.youtube.com/watch?v=${item.id.videoId}`} target="_blank" rel="noopener noreferrer">
                                                <img src={item.snippet.thumbnails.medium.url} alt="" />
                                            </a>
                                        </td>
                                        <td>
                                            <a href={`https://www.youtube.com/watch?v=${item.id.videoId}`} target="_blank" rel="noopener noreferrer" className="video-link">
                                                <div className="video-title">{item.snippet.title}</div>
                                            </a>
                                            <a href={`https://www.youtube.com/channel/${item.snippet.channelId}`} target="_blank" rel="noopener noreferrer" className="channel-link">
                                                <div className="channel-name-small">{item.snippet.channelTitle}</div>
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
                                        <td>{new Date(item.snippet.publishedAt).toLocaleDateString()}</td>
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
