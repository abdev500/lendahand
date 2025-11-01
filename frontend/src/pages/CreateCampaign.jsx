import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import RichTextEditor from '../components/RichTextEditor'
import MediaUploader from '../components/MediaUploader'
import './CreateCampaign.css'

function CreateCampaign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    short_description: '',
    description: '',
    target_amount: '',
  })
  const [mediaFiles, setMediaFiles] = useState([])

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      await api.get('/users/me/')
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleDescriptionChange = (value) => {
    setFormData({
      ...formData,
      description: value,
    })
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('short_description', formData.short_description)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('target_amount', formData.target_amount)
      formDataToSend.append('status', 'pending')

      mediaFiles.forEach((file, index) => {
        formDataToSend.append(`media_files`, file)
      })

      const response = await api.post('/campaigns/', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Redirect to dashboard with success message
      navigate('/dashboard?campaign_created=true&campaign_id=' + response.data.id)
    } catch (err) {
      const errorMessage = err.response?.data || {}
      setError(
        Object.values(errorMessage).flat().join(', ') ||
        'Failed to create campaign. Please try again.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="create-campaign">
      <div className="container">
        <h1>Create New Campaign</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="campaign-form">
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Enter campaign title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="short_description">Short Description *</label>
            <textarea
              id="short_description"
              name="short_description"
              value={formData.short_description}
              onChange={handleChange}
              required
              rows="3"
              placeholder="Brief description of your campaign"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Full Description *</label>
            <RichTextEditor
              value={formData.description}
              onChange={handleDescriptionChange}
              placeholder="Write your full campaign description here. You can format text, add links, images, and more..."
            />
            <small>Use the toolbar above to format your text, add links, images, and more</small>
          </div>

          <div className="form-group">
            <label htmlFor="target_amount">Target Amount (USD) *</label>
            <input
              type="number"
              id="target_amount"
              name="target_amount"
              value={formData.target_amount}
              onChange={handleChange}
              required
              min="1"
              step="0.01"
              placeholder="50000"
            />
          </div>

          <div className="form-group">
            <label>Media Files (Images/Videos) - Up to 6 files</label>
            <MediaUploader
              existingMedia={[]}
              selectedFiles={mediaFiles}
              onFilesChange={setMediaFiles}
              maxFiles={6}
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-cancel"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateCampaign

