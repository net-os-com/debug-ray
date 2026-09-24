import type { Tab, TabKey } from './tabs'

type TabBarProps = {
  tabs: Tab[]
  active: TabKey
  onSelect: (key: TabKey) => void
}

export function TabBar({ tabs, active, onSelect }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          className={tab.key === active ? 'tab tab--active' : 'tab'}
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          type="button"
        >
          {tab.label}
          <span className="tab__count">{tab.count}</span>
        </button>
      ))}
    </div>
  )
}
