import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Header from './components/Header'
import Home from './pages/Home'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import CreateCampaign from './pages/CreateCampaign'
import EditCampaign from './pages/EditCampaign'
import News from './pages/News'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import CreateNews from './pages/CreateNews'
import EditNews from './pages/EditNews'
import Login from './pages/Login'
import Register from './pages/Register'
import './App.css'

function App() {
  const { i18n } = useTranslation()

  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CreateCampaign />} />
          <Route path="/campaigns/:id/edit" element={<EditCampaign />} />
          <Route path="/campaign/:id" element={<CampaignDetail />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/new" element={<CreateNews />} />
          <Route path="/news/:id/edit" element={<EditNews />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

