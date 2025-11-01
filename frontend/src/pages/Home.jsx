import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import CampaignCard from '../components/CampaignCard'
import './Home.css'

function Home() {
  const { t } = useTranslation()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/?status=approved')
      setCampaigns(response.data.results || response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setLoading(false)
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <h1>{t('home.hero.title')}</h1>
          <p className="hero-subtitle">{t('home.hero.subtitle')}</p>
          <Link to="/campaigns" className="btn-primary">
            {t('home.hero.cta')}
          </Link>
        </div>
      </section>

      <section className="campaigns-preview">
        <div className="container">
          <h2>{t('campaigns.title')}</h2>
          {loading ? (
            <p>Loading...</p>
          ) : campaigns.length > 0 ? (
            <div className="campaigns-grid">
              {campaigns.slice(0, 6).map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          ) : (
            <p>No campaigns available.</p>
          )}
          <div className="view-all">
            <Link to="/campaigns" className="btn-secondary">
              View All Campaigns
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home

