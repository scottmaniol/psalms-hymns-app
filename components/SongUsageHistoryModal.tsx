import React, { useState, useEffect, useMemo } from 'react';
import { X, BarChart3, Search, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { Service, Song } from '../types';
import { 
  SongUsage, 
  DateRangeFilter, 
  aggregateSongUsage, 
  sortSongUsage, 
  filterSongUsage,
  SortBy,
  SortDirection 
} from '../utils/songUsageUtils';

interface SongUsageHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  hymnalData: Song[];
  onSelectSong: (songNumber: string) => void;
}

const SongUsageHistoryModal: React.FC<SongUsageHistoryModalProps> = ({
  isOpen,
  onClose,
  services,
  hymnalData,
  onSelectSong
}) => {
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('90days');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Aggregate and process song usage data
  const songUsageData = useMemo(() => {
    const aggregated = aggregateSongUsage(services, hymnalData, dateFilter);
    const sorted = sortSongUsage(aggregated, sortBy, sortDirection);
    return filterSongUsage(sorted, searchQuery);
  }, [services, hymnalData, dateFilter, sortBy, sortDirection, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSongs = songUsageData.length;
    const totalUsages = songUsageData.reduce((sum, song) => sum + song.count, 0);
    const uniqueServices = new Set(
      songUsageData.flatMap(song => song.services.map(s => s.serviceId))
    ).size;
    
    return { totalSongs, totalUsages, uniqueServices };
  }, [songUsageData]);

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending for count, ascending for others
      setSortBy(column);
      setSortDirection(column === 'count' ? 'desc' : 'asc');
    }
  };

  const toggleRow = (songNumber: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(songNumber)) {
        next.delete(songNumber);
      } else {
        next.add(songNumber);
      }
      return next;
    });
  };

  const handleSelectSong = (songNumber: string) => {
    onSelectSong(songNumber);
    onClose();
  };

  const getSortIcon = (column: SortBy) => {
    if (sortBy !== column) {
      return <ArrowUpDown size={14} className="opacity-40" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp size={14} /> : 
      <ChevronDown size={14} />;
  };

  const dateRangeOptions: { value: DateRangeFilter; label: string }[] = [
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '1year', label: 'Last Year' },
    { value: 'all', label: 'All Time' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Song Usage History</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {stats.totalSongs} songs used across {stats.uniqueServices} services
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200/50 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Date Range Filter */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Date Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
              >
                {dateRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Search
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by number or title..."
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {songUsageData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="text-center">
                <BarChart3 size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No songs found</p>
                <p className="text-sm mt-2">
                  {searchQuery ? 'Try a different search term' : 'No songs have been used in this time period'}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <th className="w-8"></th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('number')}
                  >
                    <div className="flex items-center gap-2">
                      #
                      {getSortIcon('number')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-2">
                      Title
                      {getSortIcon('title')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('count')}
                  >
                    <div className="flex items-center gap-2">
                      Times Used
                      {getSortIcon('count')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">
                    Latest Use
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {songUsageData.map((song, idx) => {
                  const isExpanded = expandedRows.has(song.songNumber);
                  return (
                    <React.Fragment key={song.songNumber}>
                      <tr 
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        <td className="px-2 py-3">
                          <button
                            onClick={() => toggleRow(song.songNumber)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Show service details"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                            {song.songNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {song.songTitle}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                            {song.count}×
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {song.latestUse.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleSelectSong(song.songNumber)}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Row - Service Details */}
                      {isExpanded && (
                        <tr className="bg-purple-50/50">
                          <td colSpan={6} className="px-12 py-4">
                            <div className="text-sm">
                              <p className="font-bold text-slate-700 mb-3">Used in these services:</p>
                              <div className="space-y-2">
                                {song.services.map((service, sIdx) => (
                                  <div 
                                    key={sIdx}
                                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-200"
                                  >
                                    <div>
                                      <span className="font-medium text-slate-800">
                                        {service.serviceTitle}
                                      </span>
                                    </div>
                                    <span className="text-slate-500 text-xs">
                                      {service.date.toLocaleDateString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
      </div>
    </div>
  );
};

export default SongUsageHistoryModal;
