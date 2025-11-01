import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import './Dashboard.css'

function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [campaigns, setCampaigns] = useState([])
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [activeTab, setActiveTab] = useState('campaigns')

  useEffect(() => {
    const initializeDashboard = async () => {
      await checkAuth()
      
      // Wait for user to be set before proceeding
      let currentUser = user
      if (!currentUser) {
        try {
          const userResponse = await api.get('/users/me/')
          currentUser = userResponse.data
          setUser(currentUser)
        } catch (error) {
          console.error('Error fetching user:', error)
          setLoading(false)
          return
        }
      }
      
      await fetchCampaigns()
      
      // Fetch news if user is moderator/staff
      if (currentUser && (currentUser.is_moderator || currentUser.is_staff)) {
        console.log('User is moderator/staff, fetching news...', { 
          email: currentUser.email, 
          is_moderator: currentUser.is_moderator, 
          is_staff: currentUser.is_staff 
        })
        await fetchNews()
      } else {
        console.log('User is not moderator/staff', { 
          user: currentUser ? { 
            email: currentUser.email, 
            is_moderator: currentUser.is_moderator, 
            is_staff: currentUser.is_staff 
          } : 'no user' 
        })
        setLoading(false)
      }
      
      // Check for success message from URL params
      const campaignCreated = searchParams.get('campaign_created') === 'true'
      const campaignUpdated = searchParams.get('campaign_updated') === 'true'
      const newsCreated = searchParams.get('news_created') === 'true'
      const newsUpdated = searchParams.get('news_updated') === 'true'
      
      if (campaignCreated || campaignUpdated) {
        if (campaignCreated) {
          setSuccessMessage(t('dashboard.createdSuccess'))
        } else if (campaignUpdated) {
          setSuccessMessage(t('dashboard.updatedSuccess'))
        }
        // Clear the URL params
        setSearchParams({})
        // Refresh campaigns to show new/updated campaign
        setTimeout(() => {
          fetchCampaigns()
        }, 500)
      }
      
      if (newsCreated || newsUpdated) {
        if (newsCreated) {
          setSuccessMessage(t('news.createdSuccess', 'News article created successfully!'))
        } else if (newsUpdated) {
          setSuccessMessage(t('news.updatedSuccess', 'News article updated successfully!'))
        }
        // Clear the URL params
        setSearchParams({})
        // Refresh news if user is moderator
        if (currentUser && (currentUser.is_moderator || currentUser.is_staff)) {
          setTimeout(() => {
            fetchNews()
          }, 500)
        }
      }
    }
    
    initializeDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await api.get('/users/me/')
      setUser(response.data)
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/')
      const allCampaigns = response.data.results || response.data
      
      // Get current user ID - use user state if available, otherwise fetch it
      let currentUserId
      if (user) {
        currentUserId = user.id
      } else {
        const userResponse = await api.get('/users/me/')
        currentUserId = userResponse.data.id
      }
      
      // Filter to show only campaigns created by the current user
      const myCampaigns = allCampaigns.filter(campaign => 
        campaign.created_by && campaign.created_by.id === currentUserId
      )
      setCampaigns(myCampaigns)
      if (!user || (!user.is_moderator && !user.is_staff)) {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      if (!user || (!user.is_moderator && !user.is_staff)) {
        setLoading(false)
      }
    }
  }

  const fetchNews = async () => {
    try {
      const response = await api.get('/news/')
      const allNews = response.data.results || response.data
      // Moderators can see all news (including unpublished)
      console.log('Fetched news:', allNews.length, 'items')
      setNews(allNews)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching news:', error)
      setLoading(false)
    }
  }

  const handleSuspend = async (campaignId) => {
    if (!window.confirm(t('dashboard.suspendConfirm'))) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/suspend/`)
      fetchCampaigns()
    } catch (error) {
      console.error('Error suspending campaign:', error)
      alert(t('dashboard.suspendError'))
    }
  }

  const handleCancel = async (campaignId) => {
    if (!window.confirm(t('dashboard.cancelConfirm'))) {
      return
    }

    try {
      await api.post(`/campaigns/${campaignId}/cancel/`)
      fetchCampaigns()
    } catch (error) {
      console.error('Error cancelling campaign:', error)
      alert(t('dashboard.cancelError'))
    }
  }

  const handleToggleNews = async (newsId, published) => {
    try {
      await api.patch(`/news/${newsId}/`, { published })
      setSuccessMessage(
        published
          ? t('news.publishedSuccess', 'News article published successfully!')
          : t('news.unpublishedSuccess', 'News article unpublished successfully!')
      )
      fetchNews()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error toggling news:', error)
      alert(t('news.toggleError', 'Error updating news status. Please try again.'))
    }
  }

  const handleDeleteNews = async (newsId, newsTitle) => {
    const confirmMessage = t('news.deleteConfirm', 'Are you sure you want to delete "{title}"? This action cannot be undone.').replace('{title}', newsTitle)
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      await api.delete(`/news/${newsId}/`)
      setSuccessMessage(t('news.deletedSuccess', 'News article deleted successfully!'))
      fetchNews()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      console.error('Error deleting news:', error)
      alert(t('news.deleteError', 'Error deleting news article. Please try again.'))
    }
  }

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  const getStatusBadge = (status) => {
    const statusColors = {
      'draft': '#6c757d',
      'pending': '#ffc107',
      'approved': '#28a745',
      'rejected': '#dc3545',
      'suspended': '#ff9800',
      'cancelled': '#6c757d',
    }
    
    const statusLabels = {
      'draft': t('status.draft'),
      'pending': t('status.pending'),
      'approved': t('status.approved'),
      'rejected': t('status.rejected'),
      'suspended': t('status.suspended'),
      'cancelled': t('status.cancelled'),
    }
    
    return (
      <span 
        className="status-badge"
        style={{ 
          backgroundColor: statusColors[status] || '#6c757d',
          color: status === 'pending' ? '#000' : '#fff'
        }}
      >
        {statusLabels[status] || status}
      </span>
    )
  }

  return (
    <div className="dashboard">
      <div className="container">
        <h1>{t('dashboard.title')}</h1>
        {successMessage && (
          <div className="success-message">
            {successMessage}
            <button 
              className="close-message" 
              onClick={() => setSuccessMessage('')}
            >
              ×
            </button>
          </div>
        )}
        {user && (
          <div className="user-info">
            <p><strong>{t('dashboard.email')}:</strong> {user.email}</p>
            {user.phone && <p><strong>{t('dashboard.phone')}:</strong> {user.phone}</p>}
            {user.address && <p><strong>{t('dashboard.address')}:</strong> {user.address}</p>}
          </div>
        )}

        {(user?.is_moderator || user?.is_staff) && (
          <div className="dashboard-tabs">
            <button
              className={`tab-button ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              {t('dashboard.myCampaigns')}
            </button>
            <button
              className={`tab-button ${activeTab === 'news' ? 'active' : ''}`}
              onClick={() => setActiveTab('news')}
            >
              {t('dashboard.newsManagement', 'News Management')}
            </button>
          </div>
        )}

        <div className="dashboard-actions">
          {activeTab === 'campaigns' ? (
            <Link to="/campaigns/new" className="btn-create">
              {t('campaign.createNew')}
            </Link>
          ) : (
            <Link to="/news/new" className="btn-create">
              {t('news.createNew', '+ Create New News')}
            </Link>
          )}
        </div>

        {activeTab === 'campaigns' ? (
          <div className="campaigns-section">
            <h2>{t('dashboard.myCampaigns')}</h2>
            {campaigns.length > 0 ? (
              <div className="campaigns-list">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="dashboard-campaign-card">
                    <div className="campaign-info">
                      <h3>{campaign.title}</h3>
                      <p className="campaign-status">
                        {t('dashboard.status')}: {getStatusBadge(campaign.status)}
                        {campaign.status === 'pending' && (
                          <span className="status-note"> - {t('status.awaitingApproval')}</span>
                        )}
                      </p>
                      <p className="campaign-progress">
                        ${campaign.current_amount.toLocaleString()} / ${campaign.target_amount.toLocaleString()}
                      </p>
                    </div>
                    <div className="campaign-actions">
                      <Link to={`/campaign/${campaign.id}`} className="btn-view">
                        {t('dashboard.view')}
                      </Link>
                      {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                        <Link to={`/campaigns/${campaign.id}/edit`} className="btn-edit">
                          {t('dashboard.edit')}
                        </Link>
                      )}
                      {campaign.status !== 'suspended' && campaign.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => handleSuspend(campaign.id)}
                            className="btn-suspend"
                          >
                            {t('dashboard.suspend')}
                          </button>
                          <button
                            onClick={() => handleCancel(campaign.id)}
                            className="btn-cancel"
                          >
                            {t('dashboard.cancel')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('dashboard.noCampaigns')}</p>
            )}
          </div>
        ) : (
          <div className="news-section">
            <h2>{t('dashboard.newsManagement', 'News Management')}</h2>
            {news.length > 0 ? (
              <div className="news-list">
                {news.map((item) => (
                  <div key={item.id} className="dashboard-news-card">
                    <div className="news-info">
                      <h3>{item.title}</h3>
                      <p className="news-status">
                        <span className={`status-badge ${item.published ? 'published' : 'unpublished'}`}>
                          {item.published ? t('news.published', 'Published') : t('news.unpublished', 'Unpublished')}
                        </span>
                      </p>
                      <p className="news-date">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="news-actions">
                      <Link to={`/news/${item.id}`} className="btn-view">
                        {t('dashboard.view')}
                      </Link>
                      <Link to={`/news/${item.id}/edit`} className="btn-edit">
                        {t('dashboard.edit')}
                      </Link>
                      <button
                        onClick={() => handleToggleNews(item.id, !item.published)}
                        className={`btn-toggle ${item.published ? 'btn-unpublish' : 'btn-publish'}`}
                      >
                        {item.published ? t('news.unpublish', 'Unpublish') : t('news.publish', 'Publish')}
                      </button>
                      <button
                        onClick={() => handleDeleteNews(item.id, item.title)}
                        className="btn-delete"
                      >
                        {t('news.delete', 'Delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>{t('news.noNews', 'No news articles yet.')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

