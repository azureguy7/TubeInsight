import { useState } from 'react';
import { useAppStore, formatNumber, formatDuration, type SavedItem } from '../store/useAppStore';
import { Trash2, Download, Edit3, Tag as TagIcon, Search as SearchIcon, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService } from '../services/dbService';
import './Library.css';

const Library = () => {
    const { library, removeFromLibrary, updateLibraryItem, user } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSecondaryExpanded, setIsSecondaryExpanded] = useState(true);
    const [selectedKeyword, setSelectedKeyword] = useState<string>('all');

    // Sorting
    const [sortKey, setSortKey] = useState<string>('savedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
    };

    const sortedLibrary = [...library]
        .filter((item: SavedItem) => {
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.channelTitle.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesKeyword = selectedKeyword === 'all' || item.searchQuery === selectedKeyword;
            return matchesSearch && matchesKeyword;
        })
        .sort((a, b) => {
            let valA: any;
            let valB: any;

            switch (sortKey) {
                case 'title':
                    valA = a.title.toLowerCase();
                    valB = b.title.toLowerCase();
                    break;
                case 'duration':
                    valA = parseDurationToSeconds(a.duration);
                    valB = parseDurationToSeconds(b.duration);
                    break;
                case 'subscribers':
                    valA = parseInt(a.subscriberCount || '0', 10);
                    valB = parseInt(b.subscriberCount || '0', 10);
                    break;
                case 'views':
                    valA = parseInt(a.viewCount || '0', 10);
                    valB = parseInt(b.viewCount || '0', 10);
                    break;
                case 'likes':
                    valA = parseInt(a.likeCount || '0', 10);
                    valB = parseInt(b.likeCount || '0', 10);
                    break;
                case 'contribution':
                    valA = a.contributionScore || 0;
                    valB = b.contributionScore || 0;
                    break;
                case 'performance':
                    valA = a.performanceRatio || 0;
                    valB = b.performanceRatio || 0;
                    break;
                case 'publishedAt':
                    valA = new Date(a.publishedAt).getTime();
                    valB = new Date(b.publishedAt).getTime();
                    break;
                case 'savedAt':
                    valA = new Date(a.savedAt).getTime();
                    valB = new Date(b.savedAt).getTime();
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    const primaryItems = sortedLibrary.filter(item => !item.isSecondary);
    const secondaryItems = sortedLibrary.filter(item => item.isSecondary);

    // Extract unique keywords for filter
    const uniqueKeywords = Array.from(new Set(library.map(item => item.searchQuery).filter(Boolean))) as string[];

    const handleDelete = async () => {
        if (window.confirm(`${selectedItems.size}개의 항목을 삭제하시겠습니까?`)) {
            const idsToDelete = Array.from(selectedItems);
            try {
                if (user) {
                    await dbService.removeVideos(user.id, idsToDelete);
                }
                removeFromLibrary(idsToDelete);
                setSelectedItems(new Set());
            } catch (error) {
                console.error('Delete sync failed:', error);
                alert('삭제 동기화 중 오류가 발생했습니다.');
            }
        }
    };

    const handleUpdateItem = async (id: string, updates: Partial<SavedItem>) => {
        try {
            if (user) {
                await dbService.updateVideo(user.id, id, updates);
            }
            updateLibraryItem(id, updates);
        } catch (error) {
            console.error('Update sync failed:', error);
        }
    };

    const handleExport = () => {
        const dataToExport = sortedLibrary
            .filter(item => selectedItems.size === 0 || selectedItems.has(item.id))
            .map(item => ({
                'No': item.id,
                '제목': item.title,
                '채널명': item.channelTitle,
                '업로드 날짜': new Date(item.publishedAt).toLocaleDateString(),
                '구독자수': item.subscriberCount || '0',
                '조회수': item.viewCount || '0',
                '좋아요 수': item.likeCount || '0',
                '영상 길이': formatDuration(item.duration),
                '채널 기여도(%)': (item.contributionScore || 0).toFixed(2),
                '성과도 배율': (item.performanceRatio || 0).toFixed(2),
                '메모': item.note,
                '태그': item.tags.join(', '),
                '링크': `https://www.youtube.com/watch?v=${item.id}`,
                '저장일': new Date(item.savedAt).toLocaleDateString()
            }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TubeInsight_Library');
        XLSX.writeFile(wb, `TubeInsight_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
    };

    return (
        <div className="page-container library-page">
            <header className="library-header">
                <div className="header-info">
                    <h1>보관함</h1>
                    <p>총 {library.length}개의 영상이 보관되어 있습니다.</p>
                </div>

                <div className="library-toolbar glass">
                    <div className="search-box">
                        <SearchIcon size={18} />
                        <input
                            type="text"
                            placeholder="보관함 내 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="keyword-filter-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '15px' }}>
                        <TagIcon size={16} />
                        <select
                            value={selectedKeyword}
                            onChange={(e) => setSelectedKeyword(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                outline: 'none',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="all">전체 키워드보기</option>
                            {uniqueKeywords.map(kw => (
                                <option key={kw} value={kw}>{kw}</option>
                            ))}
                        </select>
                    </div>

                    <div className="toolbar-actions">
                        <button className="btn btn-secondary" disabled={library.length === 0} onClick={handleExport}>
                            <Download size={18} /> 엑셀 내보내기
                        </button>
                        <button className="btn btn-danger" disabled={selectedItems.size === 0} onClick={handleDelete}>
                            <Trash2 size={18} /> 선택 삭제
                        </button>
                    </div>
                </div>
            </header>

            <div className="library-content glass">
                <table className="library-table">
                    <thead>
                        <tr>
                            <th className="col-check">
                                <input
                                    type="checkbox"
                                    checked={sortedLibrary.length > 0 && selectedItems.size === sortedLibrary.length}
                                    onChange={() => {
                                        if (selectedItems.size === sortedLibrary.length) setSelectedItems(new Set());
                                        else setSelectedItems(new Set(sortedLibrary.map(i => i.id)));
                                    }}
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
                                <span className="header-label">기여도</span>
                                <div className="tooltip-container">
                                    <HelpCircle size={14} className="tooltip-icon" />
                                    <div className="tooltip-text">영상 조회수 / 채널 전체 조회수 (%)</div>
                                </div>
                                {sortKey === 'contribution' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable-header" onClick={() => handleSort('performance')}>
                                <span className="header-label">성과도</span>
                                <div className="tooltip-container">
                                    <HelpCircle size={14} className="tooltip-icon" />
                                    <div className="tooltip-text">조회수 / 구독자 수</div>
                                </div>
                                {sortKey === 'performance' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th className="sortable-header" onClick={() => handleSort('publishedAt')}>
                                업로드일 {sortKey === 'publishedAt' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </th>
                            <th>메모 / 태그</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Primary Items */}
                        {primaryItems.length > 0 ? (
                            primaryItems.map((item, idx) => (
                                <tr key={item.id} className={selectedItems.has(item.id) ? 'selected' : ''} onClick={() => toggleSelect(item.id)}>
                                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                        <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                                    </td>
                                    <td>{idx + 1}</td>
                                    <td className="col-thumb">
                                        <a href={`https://www.youtube.com/watch?v=${item.id}`} target="_blank" rel="noopener noreferrer">
                                            <img src={item.thumbnail} alt="" />
                                        </a>
                                    </td>
                                    <td>
                                        <a href={`https://www.youtube.com/watch?v=${item.id}`} target="_blank" rel="noopener noreferrer" className="video-link">
                                            <div className="video-title-small">{item.title}</div>
                                        </a>
                                        <a href={`https://www.youtube.com/channel/${item.channelId}`} target="_blank" rel="noopener noreferrer" className="channel-link">
                                            <div className="channel-name-small">{item.channelTitle}</div>
                                        </a>
                                    </td>
                                    <td>{formatDuration(item.duration)}</td>
                                    <td>{formatNumber(item.subscriberCount || '0')}</td>
                                    <td>{formatNumber(item.viewCount || '0')}</td>
                                    <td>{formatNumber(item.likeCount || '0')}</td>
                                    <td>{(item.contributionScore || 0).toFixed(2)}%</td>
                                    <td className={`perf-badge ${(item.performanceRatio || 0) >= 1 ? 'high' : ''}`}>
                                        x{(item.performanceRatio || 0).toFixed(1)}
                                    </td>
                                    <td>{new Date(item.publishedAt).toLocaleDateString()}</td>
                                    <td className="col-meta" onClick={(e) => e.stopPropagation()}>
                                        <div className="note-section">
                                            {editingId === item.id ? (
                                                <textarea
                                                    autoFocus
                                                    value={item.note}
                                                    onChange={(e) => handleUpdateItem(item.id, { note: e.target.value })}
                                                    onBlur={() => setEditingId(null)}
                                                />
                                            ) : (
                                                <div className="note-text" onClick={() => setEditingId(item.id)}>
                                                    <Edit3 size={12} /> {item.note || '메모...'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="tags-list">
                                            {item.tags.map(tag => <span key={tag} className="tag-badge">{tag}</span>)}
                                            <button
                                                className="add-tag-btn"
                                                onClick={() => {
                                                    const tag = prompt('태그를 입력하세요:');
                                                    if (tag) {
                                                        const currentTags = Array.isArray(item.tags) ? item.tags : [];
                                                        handleUpdateItem(item.id, { tags: [...currentTags, tag] });
                                                    }
                                                }}
                                            >
                                                <TagIcon size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={12} className="empty-row" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
                                    보관함에 영상이 없습니다.
                                </td>
                            </tr>
                        )}

                        {/* Secondary Toggle Header */}
                        {secondaryItems.length > 0 && (
                            <tr className="secondary-toggle-row" onClick={(e) => { e.stopPropagation(); setIsSecondaryExpanded(!isSecondaryExpanded); }} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                                <td colSpan={12} style={{ padding: '0.8rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                                        <span style={{ fontSize: '0.8em', transition: 'transform 0.2s', transform: isSecondaryExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                                        <strong style={{ fontSize: '0.95rem' }}>다른 언어/지역 검색 결과 ({secondaryItems.length})</strong>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>
                                            - 주변부 실적/정보 위주 {isSecondaryExpanded ? '(접기)' : '(펼치기)'}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* Secondary Items */}
                        {secondaryItems.length > 0 && isSecondaryExpanded && secondaryItems.map((item, idx) => (
                            <tr key={item.id} className={`secondary-row ${selectedItems.has(item.id) ? 'selected' : ''}`} onClick={() => toggleSelect(item.id)} style={{ opacity: 0.7, background: 'rgba(0,0,0,0.1)' }}>
                                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} />
                                </td>
                                <td>{primaryItems.length + idx + 1}</td>
                                <td className="col-thumb">
                                    <a href={`https://www.youtube.com/watch?v=${item.id}`} target="_blank" rel="noopener noreferrer">
                                        <img src={item.thumbnail} alt="" style={{ filter: 'grayscale(0.3)' }} />
                                    </a>
                                </td>
                                <td>
                                    <a href={`https://www.youtube.com/watch?v=${item.id}`} target="_blank" rel="noopener noreferrer" className="video-link">
                                        <div className="video-title-small" style={{ color: 'var(--text-secondary)' }}>{item.title}</div>
                                    </a>
                                    <a href={`https://www.youtube.com/channel/${item.channelId}`} target="_blank" rel="noopener noreferrer" className="channel-link">
                                        <div className="channel-name-small">{item.channelTitle}</div>
                                    </a>
                                    {item.searchRegion && <span className="region-badge-small" style={{ fontSize: '0.7rem', padding: '1px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginLeft: '5px' }}>{item.searchRegion}</span>}
                                </td>
                                <td>{formatDuration(item.duration)}</td>
                                <td>{formatNumber(item.subscriberCount || '0')}</td>
                                <td>{formatNumber(item.viewCount || '0')}</td>
                                <td>{formatNumber(item.likeCount || '0')}</td>
                                <td>{(item.contributionScore || 0).toFixed(2)}%</td>
                                <td className={`perf-badge ${(item.performanceRatio || 0) >= 1 ? 'high' : ''}`}>
                                    x{(item.performanceRatio || 0).toFixed(1)}
                                </td>
                                <td>{new Date(item.publishedAt).toLocaleDateString()}</td>
                                <td className="col-meta" onClick={(e) => e.stopPropagation()}>
                                    <div className="note-section">
                                        {editingId === item.id ? (
                                            <textarea
                                                autoFocus
                                                value={item.note}
                                                onChange={(e) => handleUpdateItem(item.id, { note: e.target.value })}
                                                onBlur={() => setEditingId(null)}
                                            />
                                        ) : (
                                            <div className="note-text" onClick={() => setEditingId(item.id)}>
                                                <Edit3 size={12} /> {item.note || '메모...'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="tags-list">
                                        {item.tags.map(tag => <span key={tag} className="tag-badge">{tag}</span>)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Library;
