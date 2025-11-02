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
      // Ensure we always have an array
      const campaignsData = response.data.results || response.data || []
      setCampaigns(Array.isArray(campaignsData) ? campaignsData : [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      setCampaigns([]) // Set empty array on error
      setLoading(false)
    }
  }

  return (
    <div className="campaigns-page">
      <div className="container">
        <h1>{t('campaigns.title')}</h1>
        {loading ? (
          <p>{t('common.loading', 'Loading...')}</p>
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
