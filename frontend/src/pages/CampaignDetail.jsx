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
  const [donorName, setDonorName] = useState('')
  const [donorEmail, setDonorEmail] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
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
        donor_name: donorName,
        donor_email: donorEmail,
        is_anonymous: isAnonymous,
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
              <h3>{t('campaign.progress')}</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${campaign.progress_percentage}%` }}
                />
              </div>
              <div className="progress-stats">
                <div>
                  <span className="label">{t('campaign.raised')}</span>
                  <span className="value">${campaign.current_amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="label">{t('campaign.target')}</span>
                  <span className="value">${campaign.target_amount.toLocaleString()}</span>
                </div>
              </div>

              <form onSubmit={handleDonate} className="donation-form">
                <h3>Make a Donation</h3>
                <input
                  type="number"
                  placeholder="Amount (USD)"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                />
                <input
                  type="text"
                  placeholder="Your Name (optional)"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                />
                <input
                  type="email"
                  placeholder="Your Email (optional)"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                  Donate anonymously
                </label>
                <button type="submit" className="btn-donate" disabled={processing}>
                  {processing ? 'Processing...' : t('campaign.donate')}
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
                    <td>
                      ${donation.amount.toLocaleString()}
                      {donation.is_anonymous && (
                        <span className="anonymous-badge">
                          {t('campaign.donation.anonymous')}
                        </span>
                      )}
                    </td>
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

