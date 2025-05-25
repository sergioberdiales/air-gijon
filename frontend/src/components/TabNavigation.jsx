function TabNavigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'actual', label: 'Actual', icon: '🌡️' },
    { id: 'prediccion', label: 'Predicción', icon: '📊' }
  ];

  return (
    <div className="tab-navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default TabNavigation; 