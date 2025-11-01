import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import CampaignCard from '../components/CampaignCard'
import './Campaigns.css'

function Campaigns() {
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
    <div className="campaigns-page">
      <div className="container">
        <h1>{t('campaigns.title')}</h1>
        {loading ? (
          <p>Loading...</p>
        ) : campaigns.length > 0 ? (
          <div className="campaigns-grid">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <p>No campaigns available.</p>
        )}
      </div>
    </div>
  )
}

export default Campaigns

