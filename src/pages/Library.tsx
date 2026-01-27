import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Trash2, Download, Edit3, Tag as TagIcon, Search as SearchIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Library.css';

const Library = () => {
    const { library, removeFromLibrary, updateLibraryItem } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);

    const filteredLibrary = library.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.channelTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = () => {
        if (window.confirm(`${selectedItems.size}개의 항목을 삭제하시겠습니까?`)) {
            removeFromLibrary(Array.from(selectedItems));
            setSelectedItems(new Set());
        }
    };

    const handleExport = () => {
        const dataToExport = library
            .filter(item => selectedItems.size === 0 || selectedItems.has(item.id))
            .map(item => ({
                'ID': item.id,
                '제목': item.title,
                '채널': item.channelTitle,
                '업로드일': new Date(item.publishedAt).toLocaleDateString(),
                '보관일': new Date(item.savedAt).toLocaleDateString(),
                '메모': item.note,
                '태그': item.tags.join(', '),
                '링크': `https://www.youtube.com/watch?v=${item.id}`
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
                    <div className="toolbar-actions">
                        <button
                            className="btn btn-secondary"
                            disabled={library.length === 0}
                            onClick={handleExport}
                        >
                            <Download size={18} />
                            엑셀 내보내기
                        </button>
                        <button
                            className="btn btn-danger"
                            disabled={selectedItems.size === 0}
                            onClick={handleDelete}
                        >
                            <Trash2 size={18} />
                            선택 삭제
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
                                    checked={filteredLibrary.length > 0 && selectedItems.size === filteredLibrary.length}
                                    onChange={() => {
                                        if (selectedItems.size === filteredLibrary.length) setSelectedItems(new Set());
                                        else setSelectedItems(new Set(filteredLibrary.map(i => i.id)));
                                    }}
                                />
                            </th>
                            <th className="col-thumb">썸네일</th>
                            <th className="col-info">영상/메모</th>
                            <th className="col-tags">태그</th>
                            <th className="col-date">저장일</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLibrary.map((item) => (
                            <tr
                                key={item.id}
                                className={selectedItems.has(item.id) ? 'selected' : ''}
                                onClick={() => toggleSelect(item.id)}
                            >
                                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                    />
                                </td>
                                <td className="col-thumb">
                                    <img src={item.thumbnail} alt={item.title} />
                                </td>
                                <td className="col-info">
                                    <div className="video-title">{item.title}</div>
                                    <div className="channel-name">{item.channelTitle}</div>
                                    <div className="note-section" onClick={(e) => e.stopPropagation()}>
                                        {editingId === item.id ? (
                                            <textarea
                                                autoFocus
                                                value={item.note}
                                                onChange={(e) => updateLibraryItem(item.id, { note: e.target.value })}
                                                onBlur={() => setEditingId(null)}
                                                placeholder="메모를 입력하세요..."
                                            />
                                        ) : (
                                            <div className="note-text" onClick={() => setEditingId(item.id)}>
                                                <Edit3 size={14} />
                                                {item.note || '메모 추가...'}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="col-tags">
                                    <div className="tags-list">
                                        {item.tags.map(tag => (
                                            <span key={tag} className="tag-badge">{tag}</span>
                                        ))}
                                        <button className="add-tag-btn"><TagIcon size={12} /></button>
                                    </div>
                                </td>
                                <td className="col-date">
                                    {new Date(item.savedAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {filteredLibrary.length === 0 && (
                            <tr>
                                <td colSpan={5} className="no-results">
                                    {library.length === 0 ? '보관함이 비어 있습니다.' : '검색 결과가 없습니다.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Library;
