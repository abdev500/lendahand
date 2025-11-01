import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import ImageCarousel from '../components/ImageCarousel'
import './CampaignDetail.css'

function CampaignDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const [campaign, setCampaign] = useState(null)
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [donationAmount, setDonationAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const success = searchParams.get('success')

  useEffect(() => {
    fetchCampaign()
    fetchDonations()
  }, [id])

  useEffect(() => {
    if (success === 'true') {
      // Confirm payment after redirect
      const sessionId = searchParams.get('session_id')
      if (sessionId) {
        confirmPayment(sessionId)
      }
    }
  }, [success])

  const fetchCampaign = async () => {
    try {
      const response = await api.get(`/campaigns/${id}/`)
      setCampaign(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching campaign:', error)
      setLoading(false)
    }
  }

  const fetchDonations = async () => {
    try {
      const response = await api.get(`/donations/?campaign=${id}`)
      setDonations(response.data.results || response.data)
    } catch (error) {
      console.error('Error fetching donations:', error)
    }
  }

  const confirmPayment = async (sessionId) => {
    try {
      await api.post('/donations/confirm_payment/', { session_id: sessionId })
      // Refresh campaign and donations after successful payment
      fetchCampaign()
      fetchDonations()
    } catch (error) {
      console.error('Error confirming payment:', error)
    }
  }

  const handleDonate = async (e) => {
    e.preventDefault()
    setProcessing(true)

    try {
      const response = await api.post('/donations/create_checkout_session/', {
        campaign_id: parseInt(id),
        amount: parseFloat(donationAmount),
      })

      // Redirect to Stripe Checkout
      window.location.href = response.data.url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Error processing donation. Please try again.')
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  if (!campaign) {
    return <div className="container">Campaign not found</div>
  }

  // Check if campaign is visible (only approved campaigns are visible to public)
  const isPending = campaign.status === 'pending'
  const isDraft = campaign.status === 'draft'

  return (
    <div className="campaign-detail">
      <div className="container">
        {success === 'true' && (
          <div className="success-message">
            Thank you for your donation!
          </div>
        )}
        
        {(isPending || isDraft) && (
          <div className="warning-message">
            {isPending 
              ? 'This campaign is pending moderation and will be visible to the public once approved.'
              : 'This campaign is a draft and not yet submitted for moderation.'}
          </div>
        )}
        
        <div className="campaign-header">
          <h1>{campaign.title}</h1>
          <p className="campaign-short">{campaign.short_description}</p>
          <div className="campaign-status-badge">
            Status: <span className={`status-${campaign.status}`}>{campaign.status}</span>
          </div>
          
          {/* Progress bar in header */}
          <div className="campaign-header-progress">
            <div className="progress-bar-large">
              <div
                className="progress-fill-large"
                style={{ width: `${campaign.progress_percentage || 0}%` }}
              />
            </div>
            <div className="progress-info-large">
              <div className="progress-amount">
                <span className="progress-label">Raised</span>
                <span className="progress-value-raised">${(campaign.current_amount || 0).toLocaleString()}</span>
              </div>
              <div className="progress-percentage-large">
                {campaign.progress_percentage || 0}%
              </div>
              <div className="progress-amount">
                <span className="progress-label">Goal</span>
                <span className="progress-value-goal">${(campaign.target_amount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="campaign-layout">
          <div className="campaign-main">
            {campaign.media && campaign.media.length > 0 && (
              <ImageCarousel media={campaign.media} title={campaign.title} />
            )}

            <div className="campaign-description">
              {campaign.description ? (
                <div dangerouslySetInnerHTML={{ __html: campaign.description }} />
              ) : (
                <p>No description provided.</p>
              )}
            </div>
          </div>

          <div className="campaign-sidebar">
            <div className="donation-card">
              <h3>{t('campaign.progress') || 'Campaign Progress'}</h3>
              <div className="progress-bar-sidebar">
                <div
                  className="progress-fill-sidebar"
                  style={{ width: `${campaign.progress_percentage || 0}%` }}
                />
              </div>
              <div className="progress-stats-sidebar">
                <div className="progress-stat-item">
                  <span className="label">{t('campaign.raised') || 'Raised'}</span>
                  <span className="value-raised">${(campaign.current_amount || 0).toLocaleString()}</span>
                </div>
                <div className="progress-stat-item">
                  <span className="label">{t('campaign.target') || 'Target'}</span>
                  <span className="value-target">${(campaign.target_amount || 0).toLocaleString()}</span>
                </div>
                <div className="progress-stat-item progress-percentage-stat">
                  <span className="label">Progress</span>
                  <span className="value-percentage">{campaign.progress_percentage || 0}%</span>
                </div>
              </div>

              <form onSubmit={handleDonate} className="donation-form">
                <h3>Make a Donation</h3>
                <p className="donation-note">All donations are anonymous</p>
                <input
                  type="number"
                  placeholder="Amount (USD)"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                />
                <button type="submit" className="btn-donate" disabled={processing}>
                  {processing ? 'Processing...' : t('campaign.donate') || 'Donate Now'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="donations-section">
          <h2>{t('campaign.donations')}</h2>
          {donations.length > 0 ? (
            <table className="donations-table">
              <thead>
                <tr>
                  <th>{t('campaign.donation.amount')}</th>
                  <th>{t('campaign.donation.date')}</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.id}>
                    <td>${donation.amount.toLocaleString()}</td>
                    <td>{new Date(donation.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No donations yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default CampaignDetail

