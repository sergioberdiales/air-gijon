import ThermometerIcon from './icons/ThermometerIcon';
import BarChart3Icon from './icons/BarChart3Icon';

function TabNavigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'actual', label: 'Actual', icon: <ThermometerIcon className="tab-icon-svg" /> },
    { id: 'prediccion', label: 'Predicción', icon: <BarChart3Icon className="tab-icon-svg" /> }
  ];

  return (
    <div className="tab-navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default TabNavigation; 