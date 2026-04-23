import { useState } from 'react'
import { CategoryType } from '../services/contentApi'
import CategoriesPage from './CategoriesPage'

const TABS: { type: CategoryType; label: string }[] = [
  { type: 'movies', label: 'Movies' },
  { type: 'series', label: 'Series' },
  { type: 'tv', label: 'TV' },
  { type: 'radio', label: 'Radyo' },
]

export default function AllCategoriesPage() {
  const [activeTab, setActiveTab] = useState<CategoryType>('movies')

  return (
    <div className="space-y-6">
      <section className="glass-panel p-6 sm:p-7">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Icerik Yonetimi</div>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Kategoriler</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Tum icerik kategorilerini tek sayfada yonetin.
          </p>
        </div>

        <div className="mt-5 flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              type="button"
              onClick={() => setActiveTab(tab.type)}
              className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab.type
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <CategoriesPage categoryType={activeTab} />
    </div>
  )
}
