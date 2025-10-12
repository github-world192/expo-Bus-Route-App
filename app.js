import React, { useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';

export default function BusStopApp() {
  const [currentPage, setCurrentPage] = useState('home');
  const [previousPage, setPreviousPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState(['師大分部']);
  const [activeTab, setActiveTab] = useState('departure');

  const departureData = [
    { route: '644', time: '將到站', status: 'arriving' },
    { route: '278', time: '3分', status: 'soon' },
    { route: '復興幹線', time: '17分', status: 'soon' },
    { route: '0南', time: '未發車', status: 'not_departed' }
  ];

  const returnData = [
    { route: '羅斯福路幹線', time: '將到站', status: 'arriving' },
    { route: '643', time: '5分', status: 'soon' },
    { route: '松江新生幹線', time: '14分', status: 'soon' },
    { route: '藍 5', time: '未發車', status: 'not_departed' }
  ];

  const handleSearch = (query) => {
    if (query && !searchHistory.includes(query)) {
      setSearchHistory([query, ...searchHistory]);
    }
    setSearchQuery('');
    setCurrentPage('home');
  };

  const handleStationSelect = (station) => {
    setSearchQuery('');
    setPreviousPage('search');
    setCurrentPage('status');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'arriving': return '#EF4444';
      case 'soon': return '#3B82F6';
      case 'not_departed': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'arriving': return '將到站';
      case 'soon': return '分';
      case 'not_departed': return '未發車';
      default: return '';
    }
  };

  const HomePage = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1F2937', color: 'white', height: '100vh' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #4B5563' }}>
        <div
          onClick={() => setCurrentPage('search')}
          style={{
            backgroundColor: '#4B5563',
            borderRadius: '25px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '16px'
          }}
        >
          <Search size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
          <span style={{ color: '#9CA3AF' }}>搜尋站牌</span>
        </div>

        <div style={{ paddingBottom: '16px', borderBottom: '1px solid #4B5563', fontSize: '14px', color: '#9CA3AF' }}>
          <span>師大分部 → 師大</span>
          <span style={{ marginLeft: '12px' }}>|</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ borderTop: '1px solid #4B5563' }}>
          {[
            { route: '復興幹線', status: 'arriving' },
            { route: '278', status: 'soon' },
            { route: '復興幹線', status: 'not_departed' }
          ].map((item, idx) => (
            <div key={idx} style={{ padding: '16px 32px', borderBottom: '1px solid #4B5563', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px' }}>{item.route}</span>
              <div style={{ backgroundColor: getStatusColor(item.status), borderRadius: '20px', padding: '6px 12px', width: '80px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                {item.status === 'arriving' ? '將到站' : item.status === 'soon' ? '3分' : '未發車'}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              setPreviousPage('home');
              setCurrentPage('status');
            }}
            style={{
              width: '100%',
              padding: '16px 32px',
              marginTop: '7px',
              background: 'transparent',
              color: '#A1AA88',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            顯示出發站的完整動態
          </button>
        </div>
      </div>
    </div>
  );

  const SearchPage = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1F2937', color: 'white', height: '100vh', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={() => setCurrentPage('home')}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginRight: '12px', padding: '8px' }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1, backgroundColor: '#4B5563', borderRadius: '25px', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
          <Search size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
          <input
            style={{ flex: 1, background: 'transparent', color: 'white', border: 'none', outline: 'none', fontSize: '16px' }}
            placeholder=""
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSearch(searchQuery);
            }}
            autoFocus
          />
        </div>
      </div>

      {searchQuery === '' && (
        <div style={{ overflowY: 'auto' }}>
          <div style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '16px' }}>最近搜尋</div>
          {searchHistory.map((station, idx) => (
            <div
              key={idx}
              onClick={() => handleStationSelect(station)}
              style={{
                backgroundColor: '#374151',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              <span>{station}</span>
              <ChevronLeft size={20} color="#9CA3AF" style={{ transform: 'rotate(180deg)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const StatusPage = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#1F2937', color: 'white', height: '100vh' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #4B5563' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '24px' }}>
          <button
            onClick={() => setCurrentPage(previousPage)}
            style={{ position: 'absolute', left: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>師大分部</h1>
        </div>

        <div style={{ display: 'flex' }}>
          <button
            onClick={() => setActiveTab('departure')}
            style={{
              flex: 1,
              padding: '20px',
              background: 'transparent',
              border: 'none',
              color: activeTab === 'departure' ? 'white' : '#9CA3AF',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: activeTab === 'departure' ? '4px solid #DBE3C5' : 'none'
            }}
          >
            去
          </button>
          <button
            onClick={() => setActiveTab('return')}
            style={{
              flex: 1,
              padding: '20px',
              background: 'transparent',
              border: 'none',
              color: activeTab === 'return' ? 'white' : '#9CA3AF',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              borderBottom: activeTab === 'return' ? '4px solid #DBE3C5' : 'none'
            }}
          >
            回
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ borderTop: '1px solid #4B5563' }}>
          {(activeTab === 'departure' ? departureData : returnData).map((bus, idx) => (
            <div key={idx} style={{ padding: '16px 32px', borderBottom: '1px solid #4B5563', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px' }}>{bus.route}</span>
              <div style={{ backgroundColor: getStatusColor(bus.status), borderRadius: '20px', padding: '6px 12px', width: '80px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                {bus.status === 'soon' ? bus.time : getStatusText(bus.status)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', height: '100vh' }}>
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'search' && <SearchPage />}
      {currentPage === 'status' && <StatusPage />}
    </div>
  );
}
