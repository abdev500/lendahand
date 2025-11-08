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
  const [donationAmount, setDonationAmount] = useState('10')
  const [processing, setProcessing] = useState(false)
  const predefinedAmounts = [10, 25, 50, 100]
  const success = searchParams.get('success')

  useEffect(() => {
    fetchCampaign()
    fetchDonations()
  }, [id])

  useEffect(() => {
    if (success === 'true') {
      // Confirm payment after redirect
      const sessionId = searchParams.get('session_id')
      // Only confirm if session_id exists and is not the placeholder
      if (sessionId && sessionId !== '{CHECKOUT_SESSION_ID}' && !sessionId.includes('CHECKOUT_SESSION_ID')) {
        console.log('Confirming payment with session_id:', sessionId)
        confirmPayment(sessionId)
      } else {
        console.warn('Invalid session_id from Stripe redirect:', sessionId)
        // Still refresh in case webhook processed it
        fetchCampaign()
        fetchDonations()
      }
    }
  }, [success, searchParams])

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
      console.log('Calling confirm_payment API with session_id:', sessionId)
      const response = await api.post('/donations/confirm_payment/', { session_id: sessionId })
      console.log('Payment confirmation response:', response.data)
      // Refresh campaign and donations after successful payment
      await fetchCampaign()
      await fetchDonations()
    } catch (error) {
      console.error('Error confirming payment:', error)
      console.error('Error details:', error.response?.data)
      // Still refresh to show any updates from webhook
      fetchCampaign()
      fetchDonations()
    }
  }

  const handleDonate = async (e) => {
    e.preventDefault()

    // Validate amount
    const amount = parseFloat(donationAmount)
    if (!amount || amount <= 0) {
      alert(t('campaign.donation.invalidAmount', 'Please enter a valid donation amount.'))
      return
    }

    setProcessing(true)

    try {
      const response = await api.post('/donations/create_checkout_session/', {
        campaign_id: parseInt(id),
        amount: amount,
      })

      // Check if response has URL
      if (response.data && response.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url
      } else {
        throw new Error('No checkout URL received from server')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      const errorMessage = error.response?.data?.error ||
                          error.response?.data?.detail ||
                          error.message ||
                          t('campaign.donation.error', 'Failed to create donation session. Please try again.')
      alert(errorMessage)
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  if (!campaign) {
    return <div className="container">{t('campaign.notFound')}</div>
  }

  // Check if campaign is visible (only approved campaigns are visible to public)
  const isPending = campaign.status === 'pending'
  const isDraft = campaign.status === 'draft'
  const stripeReady = !!campaign.stripe_ready

  return (
    <div className="campaign-detail">
      <div className="container">
        {success === 'true' && (
          <div className="success-message">
            {t('campaign.donation.success')}
          </div>
        )}

        {(isPending || isDraft) && (
          <div className="warning-message">
            {isPending
              ? t('campaign.pendingWarning')
              : t('campaign.draftWarning')}
          </div>
        )}

        <div className="campaign-header">
          <h1>{campaign.title}</h1>
          <p className="campaign-short">{campaign.short_description}</p>
          <div className="campaign-status-badge">
            {t('dashboard.status')}: <span className={`status-${campaign.status}`}>{campaign.status}</span>
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
                <span className="progress-label">{t('campaign.raised')}</span>
                <span className="progress-value-raised">€{(campaign.current_amount || 0).toLocaleString()}</span>
              </div>
              <div className="progress-percentage-large">
                {campaign.progress_percentage || 0}%
              </div>
              <div className="progress-amount">
                <span className="progress-label">{t('campaign.target')}</span>
                <span className="progress-value-goal">€{(campaign.target_amount || 0).toLocaleString()}</span>
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
                <p>{t('campaign.noDescription')}</p>
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
                  <span className="label">{t('campaign.raised')}</span>
                  <span className="value-raised">€{(campaign.current_amount || 0).toLocaleString()}</span>
                </div>
                <div className="progress-stat-item">
                  <span className="label">{t('campaign.target')}</span>
                  <span className="value-target">€{(campaign.target_amount || 0).toLocaleString()}</span>
                </div>
                <div className="progress-stat-item progress-percentage-stat">
                  <span className="label">{t('campaign.progress')}</span>
                  <span className="value-percentage">{campaign.progress_percentage || 0}%</span>
                </div>
              </div>

              <form onSubmit={handleDonate} className="donation-form">
                <h3>{t('campaign.donate')}</h3>
                <p className="donation-note">{t('campaign.anonymousDonations')}</p>
                {!stripeReady && (
                  <div className="donation-warning">
                    {t('campaign.stripePending', 'Donations are temporarily disabled until the campaign completes Stripe onboarding.')}
                  </div>
                )}
                <div className="predefined-amounts">
                  {predefinedAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={`amount-btn ${donationAmount === amount.toString() ? 'active' : ''}`}
                      onClick={() => setDonationAmount(amount.toString())}
                    >
                      €{amount}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder={t('campaign.donation.amountPlaceholder', 'Enter amount in EUR')}
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  required
                  min="1"
                  step="0.01"
                />
                <button
                  type="submit"
                  className="btn-donate"
                  disabled={
                    processing ||
                    !donationAmount ||
                    parseFloat(donationAmount || 0) <= 0 ||
                    !stripeReady
                  }
                >
                  {processing ? t('campaign.processing') : t('campaign.donate')}
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
                    <td>€{donation.amount.toLocaleString()}</td>
                    <td>{new Date(donation.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{t('campaign.noDonations', 'No donations yet. Be the first!')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default CampaignDetail
